import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { AckType } from "../internal/pubsub/consume.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import type { ConfirmChannel } from "amqplib";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
    return (ps: PlayingState) => {
        handlePause(gs, ps);
        process.stdout.write("> ");
        return AckType.Ack;
    };
};

export function handlerMove(gs: GameState, ch: ConfirmChannel): (move: ArmyMove) => AckType {
    return (move: ArmyMove) => {
        const move_outcome = handleMove(gs, move);
        const message = `Moved ${move.units.length} units to ${move.toLocation}`;
        console.log(message);
        process.stdout.write("> ");

        switch (move_outcome) {
            case MoveOutcome.Safe:
                return AckType.Ack;
            case MoveOutcome.MakeWar:
                publishJSON(ch, ExchangePerilTopic, `${WarRecognitionsPrefix}.${gs.getUsername()}`, {attacker: move.player, defender: gs.getPlayerSnap().username})
                // return AckType.Ack;
                return AckType.NackRequeue;
            case MoveOutcome.SamePlayer:
                return AckType.NackDiscard;
            default:
                return AckType.NackDiscard;
        };
    };
};
export interface RecognitionOfWar {
  attacker: Player;
  defender: Player;
}



export function handlerWar(gs: GameState, ch: ConfirmChannel): (rw: RecognitionOfWar) => AckType {
    return (rw: RecognitionOfWar) => {
        const warResolution = handleWar(gs, rw);

        // process.stdout.write("> ");
        console.log("> ");
        switch (warResolution.result) {
            case WarOutcome.NotInvolved:
                return AckType.NackRequeue;
            case WarOutcome.NoUnits:
                return AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                return AckType.Ack;
            case WarOutcome.YouWon:
                return AckType.Ack;
            case WarOutcome.Draw:
                return AckType.Ack;
            default:
                console.error("Invalid warResolution");
                return AckType.NackDiscard;
        }
    }
}