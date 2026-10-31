import type { Experience } from './types'

// DATOS DE EJEMPLO (placeholder): estructuras de prueba para diseñar el módulo mientras no haya
// operadores reales cargados. Sin precios ni contactos reales: precio y reserva «por confirmar».

const base = { image: null, rating: null, contact: {}, placeholder: true, priceFrom: null } as const

export const PLACEHOLDER_EXPERIENCES: Experience[] = [
  { ...base, id: 'ej-rosario', businessName: 'Operador de ejemplo', title: 'Pasadía en Islas del Rosario', category: 'islas', destination: 'Islas del Rosario', duration: 'Día completo', capacity: 20, schedules: ['Salida 8:00 a. m.', 'Regreso 4:00 p. m.'], status: 'available' },
  { ...base, id: 'ej-baru', businessName: 'Operador de ejemplo', title: 'Día de playa en Barú', category: 'islas', destination: 'Playa Blanca, Barú', duration: 'Día completo', capacity: 25, schedules: ['Salida 8:30 a. m.'], status: 'available' },
  { ...base, id: 'ej-tierrabomba', businessName: 'Operador de ejemplo', title: 'Tierra Bomba en lancha', category: 'islas', destination: 'Tierra Bomba', duration: 'Medio día', capacity: 12, schedules: ['9:00 a. m.', '1:00 p. m.'], status: 'soon' },
  { ...base, id: 'ej-traslado', businessName: 'Operador de ejemplo', title: 'Traslado a las islas', category: 'transporte', destination: 'Muelle → Islas del Rosario', duration: '1 hora por trayecto', capacity: 30, schedules: ['Cada hora desde las 7:00 a. m.'], status: 'available' },
  { ...base, id: 'ej-taxi', businessName: 'Operador de ejemplo', title: 'Lancha taxi a Tierra Bomba', category: 'transporte', destination: 'Tierra Bomba', duration: '20 minutos', capacity: 8, schedules: ['Según demanda'], status: 'available' },
  { ...base, id: 'ej-bahia', businessName: 'Operador de ejemplo', title: 'Recorrido por la bahía', category: 'bahia', destination: 'Bahía de Cartagena', duration: '2 horas', capacity: 40, schedules: ['10:00 a. m.', '3:00 p. m.'], status: 'available' },
  { ...base, id: 'ej-castillo', businessName: 'Operador de ejemplo', title: 'Fuertes desde el agua', category: 'bahia', destination: 'Bocachica y fuertes', duration: '3 horas', capacity: 30, schedules: ['9:00 a. m.'], status: 'soon' },
  { ...base, id: 'ej-sunset', businessName: 'Operador de ejemplo', title: 'Sunset frente a la muralla', category: 'atardecer', destination: 'Bahía · Centro Histórico', duration: '1 h 30 min', capacity: 35, schedules: ['Todos los días 5:00 p. m.'], status: 'available' },
  { ...base, id: 'ej-sunset-musica', businessName: 'Operador de ejemplo', title: 'Atardecer con música en vivo', category: 'atardecer', destination: 'Bahía de Cartagena', duration: '2 horas', capacity: 50, schedules: ['Viernes y sábados 5:00 p. m.'], status: 'soldout' },
  { ...base, id: 'ej-cena', businessName: 'Operador de ejemplo', title: 'Cena a bordo para dos', category: 'romantico', destination: 'Bahía de Cartagena', duration: '2 h 30 min', capacity: 2, schedules: ['7:00 p. m.'], status: 'available' },
  { ...base, id: 'ej-propuesta', businessName: 'Operador de ejemplo', title: 'Paseo privado de aniversario', category: 'romantico', destination: 'Bahía e islas cercanas', duration: '3 horas', capacity: 2, schedules: ['Horario a convenir'], status: 'soon' },
  { ...base, id: 'ej-yate', businessName: 'Operador de ejemplo', title: 'Yate privado por el día', category: 'yates', destination: 'Islas del Rosario', duration: 'Día completo', capacity: 12, schedules: ['Horario a convenir'], status: 'available' },
  { ...base, id: 'ej-lancha', businessName: 'Operador de ejemplo', title: 'Lancha privada a Barú', category: 'yates', destination: 'Barú', duration: 'Día completo', capacity: 10, schedules: ['Desde las 7:30 a. m.'], status: 'available' },
]
