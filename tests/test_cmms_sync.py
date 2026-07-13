import unittest

from cmms_sync_core import SyncEventData, SyncService, UnsupportedAggregate


class FakePocketBase:
    def __init__(self):
        self.rows = {}
        self.sequence = 0
        self.fail_collection_once = None

    def find_one(self, collection, field, value):
        return next(
            (row for row in self.rows.get(collection, []) if row.get(field) == value),
            None,
        )

    def create(self, collection, body):
        if self.fail_collection_once == collection:
            self.fail_collection_once = None
            raise RuntimeError("temporary PocketBase failure")
        self.sequence += 1
        row = {"id": f"r{self.sequence}", **body}
        self.rows.setdefault(collection, []).append(row)
        return row

    def update(self, collection, record_id, body):
        row = next(row for row in self.rows[collection] if row["id"] == record_id)
        row.update(body)
        return row


def event(**overrides):
    values = {
        "event_id": "evt-1",
        "event_type": "work_order.status_changed",
        "aggregate_type": "work_order",
        "aggregate_id": "wo-1",
        "payload": {"status": "in_progress", "version": 1},
    }
    values.update(overrides)
    return SyncEventData(**values)


class SyncServiceTests(unittest.TestCase):
    def setUp(self):
        self.pb = FakePocketBase()
        self.service = SyncService(self.pb)

    def test_duplicate_returns_original_receipt_without_second_write(self):
        first = self.service.deliver(event(), "key-1")
        second = self.service.deliver(event(), "key-1")
        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(first["receipt_id"], second["receipt_id"])
        self.assertEqual(1, len(self.pb.rows["cmms_work_orders"]))

    def test_closed_work_order_cannot_be_reopened(self):
        self.pb.create(
            "cmms_work_orders",
            {"supabase_id": "wo-1", "status": "closed", "version": 1},
        )
        self.service.deliver(event(payload={"status": "in_progress", "version": 2}), "key-2")
        row = self.pb.find_one("cmms_work_orders", "supabase_id", "wo-1")
        self.assertEqual("closed", row["status"])

    def test_older_version_does_not_overwrite_newer_record(self):
        self.pb.create(
            "cmms_assets",
            {"supabase_id": "asset-1", "status": "available", "version": 5},
        )
        self.service.deliver(
            event(
                aggregate_type="asset",
                aggregate_id="asset-1",
                payload={"status": "down", "version": 4},
            ),
            "key-3",
        )
        row = self.pb.find_one("cmms_assets", "supabase_id", "asset-1")
        self.assertEqual("available", row["status"])
        self.assertEqual(5, row["version"])

    def test_unsupported_aggregate_marks_receipt_failed(self):
        with self.assertRaises(UnsupportedAggregate):
            self.service.deliver(event(aggregate_type="unknown"), "key-4")
        receipt = self.pb.find_one("cmms_sync_receipts", "idempotency_key", "key-4")
        self.assertEqual("failed", receipt["status"])

    def test_payload_does_not_override_pocketbase_record_identity(self):
        self.service.deliver(
            event(payload={
                "id": "47f6c725-e65f-4085-a5bd-0a655ae70bc0",
                "collectionId": "internal",
                "collectionName": "wrong_collection",
                "status": "open",
                "version": 1,
            }),
            "key-5",
        )
        row = self.pb.find_one("cmms_work_orders", "supabase_id", "wo-1")
        self.assertEqual("r2", row["id"])
        self.assertNotIn("collectionId", row)
        self.assertNotIn("collectionName", row)

    def test_failed_receipt_can_be_retried(self):
        self.pb.fail_collection_once = "cmms_work_orders"
        with self.assertRaises(RuntimeError):
            self.service.deliver(event(), "key-6")
        failed = self.pb.find_one("cmms_sync_receipts", "idempotency_key", "key-6")
        self.assertEqual("failed", failed["status"])

        retried = self.service.deliver(event(), "key-6")
        self.assertFalse(retried["duplicate"])
        self.assertEqual(failed["id"], retried["receipt_id"])
        self.assertEqual("committed", failed["status"])
        self.assertEqual(1, len(self.pb.rows["cmms_work_orders"]))


if __name__ == "__main__":
    unittest.main()
