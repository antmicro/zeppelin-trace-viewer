/*
 * Copyright (c) 2025 Analog Devices, Inc.
 * Copyright (c) 2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * The module gathering all panel definitions.
 */

import InfoPanel from "./info-panel";
import CPULoadPanel from "./cpu-load-panel";
import DieTempPanel from "./die-temp-panel";

export {InfoPanel, CPULoadPanel, DieTempPanel};
export * from "./memory-panel";
