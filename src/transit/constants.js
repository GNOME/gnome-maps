/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026, Marcus Lundblad.
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import Gdk from 'gi://Gdk';

export const DEFAULT_ROUTE_COLOR = new Gdk.RGBA({ red:   0x4c / 255,
                                                  green: 0x4c / 255,
                                                  blue:  0x4c / 255,
                                                  alpha: 1.0 });
export const DEFAULT_ROUTE_TEXT_COLOR = new Gdk.RGBA({ red:   1.0,
                                                       green: 1.0,
                                                       blue:  1.0,
                                                       alpha: 1.0 });
export const DEFAULT_DARK_ROUTE_COLOR = new Gdk.RGBA({ red:   0xde / 255,
                                                       green: 0xdd / 255,
                                                       blue:  0xda / 255,
                                                       alpha: 1.0 });
export const DEFAULT_DARK_ROUTE_TEXT_COLOR = new Gdk.RGBA({ red:   0x24 / 255,
                                                            green: 0x1f / 255,
                                                            blue:  0x31 / 255,
                                                            alpha: 1.0 });
