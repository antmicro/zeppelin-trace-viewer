/**
 * The module with load plot definition.
 */


import { CPULoadEventType } from '../event-types';
import { LinePlot } from './line-plot';

export class CPULoadPlot extends LinePlot<CPULoadEventType> {
    protected _xAccess(e: CPULoadEventType): number {
        return e.ts / 1e3;
    }
    protected _yAccess(e: CPULoadEventType): number {
        return e.cpu_load / 10;
    }

    protected _xLabel(): string | null {
        return "Timestamp [ms]";
    }

    protected _yLabel(): string | null {
        return "Load [%]";
    }

    protected _annotationNote(d: CPULoadEventType): { title: string; note: string; } {
        return {
            title: 'CPU Load',
            note: `Timestamp ${this._xAccess(d).toFixed(2)}ms\n`
                + `Load ${this._yAccess(d).toFixed(2)}%\n`,
        };
    }
}
