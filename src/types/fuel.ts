export interface FuelLog {
  id: string;
  fecha: string;
  hora: string;
  unidad: string;
  operador: string;
  tipo_combustible: 'ULSD' | 'Diesel' | 'Gasolina';
  litros: number;
  costo: number;
  horometro: number;
  km: number;
  rendimiento: number;
  estacion: string;
  observaciones: string;
  anomaly_flag: boolean;
}
