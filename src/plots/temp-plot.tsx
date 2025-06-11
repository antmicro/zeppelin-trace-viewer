/**
 * The module with temp plot definition.
 */


import { TempEventType } from '../event-types';
import { LinePlot } from './line-plot';

export class DieTempPlot extends LinePlot<TempEventType> {
    protected _xAccess(e: TempEventType): number {
        return e.ts / 1e3;
    }
    protected _yAccess(e: TempEventType): number {
        return e.temp;
    }

    protected _xLabel(): string | null {
        return "Timestamp [ms]";
    }

    protected _yLabel(): string | null {
        return "Temperature [℃]";
    }

    protected _annotationNote(d: TempEventType): { title: string; note: string; } {
        return {
            title: d.sensor,
            note: `Timestamp ${this._xAccess(d).toFixed(2)}ms\n`
                + `Temp ${this._yAccess(d).toFixed(2)}℃\n`,
        };
    }
}
