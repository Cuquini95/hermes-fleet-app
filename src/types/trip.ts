export interface TripLog {
  id: string;
  fecha: string;
  hora: string;
  camion: string;
  conductor: string;
  ruta_origen: string;
  ruta_destino: string;
  km_cargado: number;
  km_vacio: number;
  km_total: number;
  material: 'Tierra' | 'Roca' | 'Grava' | 'Mineral' | 'Caliza' | 'Otro';
  tonelaje: number;
  observaciones: string;
}
