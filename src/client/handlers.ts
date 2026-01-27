import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => void {
    const handler_func = (ps: PlayingState) => {
        handlePause(gs, ps);
        console.log("> ");
    };
    return handler_func
};