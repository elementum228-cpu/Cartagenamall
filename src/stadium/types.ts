import type { StadiumEventKind } from "../config/stadium";
import type { EventBoard } from "./board";

/** Tipo de boleta de un evento (por ejemplo «General», «Platea», «VIP») con su precio y cupo. */
export interface TicketTier {
  id: string;
  name: string;
  /** Precio en COP por boleta. */
  price: number;
  /** Cuántas boletas hay de este tipo. */
  capacity: number;
}

export type EventStatus = "draft" | "published" | "cancelled";

/** Evento del estadio: partido de fútbol o concierto. */
export interface StadiumEvent {
  id: string;
  title: string;
  /** Rival, artista invitado, categoría… */
  subtitle: string;
  kind: StadiumEventKind;
  /** Fecha y hora de inicio (ISO). */
  startsAt: string;
  description: string;
  status: EventStatus;
  tiers: TicketTier[];
  /** Canción del concierto (suena en el estadio cuando este evento está «en escena»). */
  songUrl: string | null;
  /** Cartel del estadio para este evento: escudos de los dos equipos o imagen del concierto. */
  board?: EventBoard;
  createdAt: string;
}

export type TicketStatus = "pending" | "confirmed" | "cancelled" | "used";

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  tierId: string;
  tierName: string;
  qty: number;
  unitPrice: number;
  total: number;
  buyerName: string;
  whatsapp: string;
  status: TicketStatus;
  /** Código que el comprador presenta en la entrada. */
  code: string;
  createdAt: string;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  used: "Usada",
};
