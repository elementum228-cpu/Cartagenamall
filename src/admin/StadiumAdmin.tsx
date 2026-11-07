import { HardHat, Music2, Play, Square, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { EVENT_KINDS, PHASES } from "../config/stadium";
import { MAX_SONG_BYTES, uploadStadiumSong } from "../remote/photos";
import { remoteEnabled } from "../remote/client";
import {
  stopStadiumSound,
  toggleSongPreview,
  useStadiumEvent,
  useStadiumPhase,
  useStadiumSong,
  useStadiumSound,
} from "../state/stadium";
import { useUI } from "../state/ui";
import { btn, input } from "../ui/bits";
import { EventsManager } from "../stadium/EventsManager";
import { useCatalog } from "../state/catalog";
import { useStadiumBoard, useStadiumConfig } from "../state/stadiumEvents";
import { BoardEditor } from "../stadium/BoardEditor";

/** Administración del estadio: estado, tipo de evento y la canción del concierto con el ambiente del público. */
export function StadiumAdmin() {
  const phase = useStadiumPhase((s) => s.phase);
  const setPhase = useStadiumPhase((s) => s.setPhase);
  const kind = useStadiumEvent((s) => s.kind);
  const setKind = useStadiumEvent((s) => s.setKind);
  const song = useStadiumSong();
  const preview = useStadiumSound((s) => s.preview);
  const toast = useUI((s) => s.toast);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stores = useCatalog((s) => s.stores);
  const operator = useStadiumConfig((s) => s.operatorStoreId);
  const setConfig = useStadiumConfig((s) => s.set);
  const board = useStadiumBoard((s) => s.board);
  const setBoard = useStadiumBoard((s) => s.setBoard);

  const pick = async (f: File) => {
    if (
      !/^audio\//.test(f.type) &&
      !/\.(mp3|m4a|aac|wav|ogg|mp4)$/i.test(f.name)
    )
      return toast("Elige un archivo de audio (mp3, m4a, wav…).", "error");
    if (f.size > MAX_SONG_BYTES)
      return toast(
        "El audio pesa más de 10 MB. Prueba con uno más corto o comprimido.",
        "error",
      );
    setBusy(true);
    stopStadiumSound();
    try {
      let url: string;
      if (remoteEnabled()) url = await uploadStadiumSong(f);
      else {
        // sin base de datos (demostración): la canción vive solo en esta sesión de este navegador
        url = URL.createObjectURL(f);
        toast(
          "Sin conexión a la base de datos: la canción solo suena en este navegador.",
        );
      }
      song.setSong({
        url,
        title: song.title || f.name.replace(/\.[^.]+$/, ""),
      });
      toast("Canción cargada. Pruébala con «Escuchar la mezcla».", "success");
    } catch (e) {
      toast(
        e instanceof Error
          ? `No se pudo subir: ${e.message}`
          : "No se pudo subir la canción.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="flex items-center gap-2 font-bold">
          <HardHat className="size-4" /> Estado del estadio
        </p>
        <p className="text-xs text-ink-soft">
          Lo ven todos los visitantes del mall.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PHASES.map((p) => (
            <button
              key={p.id}
              aria-pressed={phase === p.id}
              onClick={() => {
                stopStadiumSound();
                setPhase(p.id);
              }}
              className={`rounded-2xl border p-3 text-left transition ${phase === p.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-sand"}`}
            >
              <span className="block text-sm font-bold">{p.label}</span>
              <span
                className={`block text-[11.5px] ${phase === p.id ? "text-white/80" : "text-ink-soft"}`}
              >
                {p.note}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="flex items-center gap-2 font-bold">
          <Music2 className="size-4" /> Evento de hoy
        </p>
        <p className="text-xs text-ink-soft">
          Con el estadio inaugurado: partido de fútbol o concierto con tarima y
          pantalla.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EVENT_KINDS.map((k) => (
            <button
              key={k.id}
              aria-pressed={kind === k.id}
              onClick={() => {
                stopStadiumSound();
                setKind(k.id);
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${kind === k.id ? "bg-ink text-white" : "border border-line bg-white text-ink-soft hover:bg-sand"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Negocio que opera el estadio</p>
        <p className="text-xs text-ink-soft">
          Gestiona eventos y boletas desde «Mi negocio» y recibe las reservas.
        </p>
        <select
          className={`${input} mt-2`}
          value={operator ?? ""}
          onChange={(e) =>
            setConfig({ operatorStoreId: e.target.value || null })
          }
          aria-label="Negocio operador"
        >
          <option value="">Solo el administrador</option>
          {stores.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <EventsManager />
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Cartel general del estadio</p>
        <p className="mb-3 text-xs text-ink-soft">
          El cartel que se enciende de noche sobre la tribuna.{" "}
          {kind === "match"
            ? "En partido: los dos escudos."
            : "En concierto: la imagen del artista."}{" "}
          Si el evento en escena tiene su propio cartel, ese manda; este se usa
          cuando no hay evento en escena.
        </p>
        <BoardEditor
          kind={kind}
          value={board}
          onChange={setBoard}
          title={song.title}
        />
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Canción del concierto</p>
        <p className="text-xs text-ink-soft">
          Canción general (la de un evento «en escena» tiene prioridad). Suena
          dentro del estadio con eco de recinto y el ambiente de una hinchada
          emocionada: aplausos, gritos de ánimo y bulla, sin cantar. Se oye
          cuando el evento es «Concierto» y el estadio está encendido.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-ink-soft">
            Nombre del concierto o artista
            <input
              className={`${input} mt-1`}
              value={song.title}
              onChange={(e) => song.setSong({ title: e.target.value })}
              placeholder="Ej. Concierto de Luister La Voz"
              maxLength={80}
            />
          </label>
          <div>
            <p className="text-xs font-bold text-ink-soft">Audio</p>
            <input
              ref={file}
              type="file"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
              className="hidden"
              aria-label="Subir canción"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pick(f);
              }}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                className={btn.secondary}
                disabled={busy}
                onClick={() => file.current?.click()}
              >
                <Upload className="size-4" />{" "}
                {busy
                  ? "Subiendo…"
                  : song.url
                    ? "Cambiar canción"
                    : "Subir canción"}
              </button>
              {song.url && (
                <button
                  className={btn.ghost}
                  onClick={() => {
                    stopStadiumSound();
                    song.setSong({ url: null });
                  }}
                >
                  <Trash2 className="size-4" /> Quitar
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">
              {song.url
                ? "Canción propia cargada."
                : "Sin canción propia: suena la canción por defecto del estadio."}{" "}
              Máximo 10 MB (mp3, m4a, wav).
            </p>
          </div>
        </div>

        <label className="mt-3 block text-xs font-bold text-ink-soft">
          Ambiente del público · {Math.round(song.crowd * 100)} %
          <input
            type="range"
            className="mt-1 w-full accent-brand"
            min={0}
            max={100}
            value={Math.round(song.crowd * 100)}
            onChange={(e) =>
              song.setSong({ crowd: Number(e.target.value) / 100 })
            }
          />
        </label>

        <button
          className={`${btn.primary} mt-3`}
          onClick={async () => {
            const ok = await toggleSongPreview();
            if (!ok)
              toast(
                "No se pudo reproducir el audio. Revisa el archivo.",
                "error",
              );
          }}
        >
          {preview ? (
            <Square className="size-4" />
          ) : (
            <Play className="size-4" />
          )}{" "}
          {preview ? "Detener la mezcla" : "Escuchar la mezcla"}
        </button>
      </div>
    </div>
  );
}
