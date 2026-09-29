import { memo, type MutableRefObject } from "react";
import {
  clock,
  slotLabel,
  statuses,
  type Poll,
  type Vote,
  type Status,
} from "@/lib/domain";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { heatStyle } from "@/lib/preference-heat";
import type { Counts } from "@/lib/vote-index";
import { SlotPeople } from "./slot-people";
type Brush = Status | "erase";
type Props = {
  slotKey: string;
  compact: boolean;
  poll: Poll;
  votes: Vote[];
  mine?: Status;
  s: Counts;
  ownStatus?: Status;
  layer: string;
  brush: Brush;
  disabled: boolean;
  heatCount: number;
  heatMax: number;
  painting: MutableRefObject<boolean>;
  mousePainted: MutableRefObject<boolean>;
  dragBrush: MutableRefObject<Brush>;
  paint: (key: string, action: Brush, toggle?: boolean) => void;
  onInspect: (key: string) => void;
};
export const CalendarSlot = memo(function CalendarSlot({
  slotKey: key,
  compact,
  poll,
  votes,
  mine,
  s,
  ownStatus,
  layer,
  brush,
  disabled,
  heatCount,
  heatMax,
  painting,
  mousePainted,
  dragBrush,
  paint,
  onInspect,
}: Props) {
  const common = votes.length > 0 && s.yes === votes.length;
  const background = { ...s };
  if (ownStatus) background[ownStatus]--;
  const othersMarked = background.yes + background.maybe + background.no;
  const cls =
    layer === "mine"
      ? mine || (othersMarked ? "group-context" : "")
      : common
        ? "common"
        : s.no
          ? "no"
          : s.yes
            ? "yes"
            : s.maybe
              ? "maybe"
              : "";
  return (
    <Tooltip key={key}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={
            "slot heat-slot " +
            cls +
            (s.yes + s.maybe + s.no > 0 ? " with-context" : "")
          }
          style={heatStyle(heatCount, heatMax)}
          disabled={disabled}
          aria-label={`${slotLabel(poll, key)}: ${layer === "mine" ? (mine ? statuses[mine] : "Sin respuesta") : `${s.yes} disponibles, ${s.maybe} si hace falta, ${s.no} ocupados de ${votes.length}`}`}
          aria-pressed={layer === "mine" ? !!mine : undefined}
          aria-haspopup={layer === "group" ? "dialog" : undefined}
          onPointerDown={(e) => {
            if (layer === "group") return;
            mousePainted.current = false;
            if (e.pointerType === "mouse" && e.button === 0) {
              e.preventDefault();
              mousePainted.current = true;
              painting.current = true;
              dragBrush.current =
                brush === "erase" || mine === brush ? "erase" : brush;
              paint(key, dragBrush.current);
            }
          }}
          onPointerEnter={(e) => {
            if (painting.current && e.buttons === 1)
              paint(key, dragBrush.current);
          }}
          onClick={(e) => {
            if (layer === "group") {
              onInspect(key);
              return;
            }
            if (e.detail !== 0 && mousePainted.current) {
              mousePainted.current = false;
              return;
            }
            paint(key, brush, true);
          }}
        >
          <span
            className={
              "slot-personal" +
              (layer === "mine" && mine ? " personal-" + mine : "")
            }
          >
            {compact ? (
              <span>
                {clock(Number(key.split("@")[1]))}{" "}
                {layer === "mine"
                  ? mine === "yes"
                    ? "✓"
                    : mine === "maybe"
                      ? "?"
                      : mine === "no"
                        ? "×"
                        : ""
                  : s.yes > 0
                    ? `${s.yes}/${votes.length}`
                    : ""}
              </span>
            ) : layer === "mine" ? (
              mine === "yes" ? (
                "✓"
              ) : mine === "maybe" ? (
                "?"
              ) : mine === "no" ? (
                "×"
              ) : (
                ""
              )
            ) : s.yes + s.maybe + s.no ? (
              `${s.yes}/${votes.length}`
            ) : (
              ""
            )}
          </span>
          {(layer === "mine" ? othersMarked : s.yes + s.maybe + s.no) > 0 && (
            <span
              className="slot-group-context"
              aria-label={`${layer === "mine" ? "Otras personas" : "Grupo"}: ${layer === "mine" ? background.yes : s.yes} disponibles, ${layer === "mine" ? background.maybe : s.maybe} si hace falta, ${layer === "mine" ? background.no : s.no} ocupadas`}
            >
              {(layer === "mine" ? background.yes : s.yes) > 0 && (
                <span className="context-yes">
                  ✓ {layer === "mine" ? background.yes : s.yes}
                </span>
              )}
              {(layer === "mine" ? background.maybe : s.maybe) > 0 && (
                <span className="context-maybe">
                  ? {layer === "mine" ? background.maybe : s.maybe}
                </span>
              )}
              {(layer === "mine" ? background.no : s.no) > 0 && (
                <span className="context-no">
                  × {layer === "mine" ? background.no : s.no}
                </span>
              )}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="slot-names-tooltip">
        <SlotPeople
          poll={poll}
          votes={votes}
          slotKey={key}
          s={s}
          layer={layer}
          mine={mine}
        />
      </TooltipContent>
    </Tooltip>
  );
});
