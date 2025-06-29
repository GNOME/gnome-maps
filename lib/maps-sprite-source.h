/*
 * Copyright (C) 2023 James Westman <james@jwestman.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

#pragma once

#include <shumate/shumate.h>

#include "maps-shield.h"

G_BEGIN_DECLS

#define MAPS_TYPE_SPRITE_SOURCE (maps_sprite_source_get_type())
G_DECLARE_FINAL_TYPE (MapsSpriteSource, maps_sprite_source, MAPS, SPRITE_SOURCE, GObject)

MapsSpriteSource *maps_sprite_source_new (const char *color_scheme);

void maps_sprite_source_set_fallback (MapsSpriteSource *self, ShumateVectorSpriteSheet *sprite_sheet);

void maps_sprite_source_load_shield_defs (MapsSpriteSource *self, const char *json);

MapsShield *maps_sprite_source_get_shield_for_network (MapsSpriteSource *self,
                                                       const char *network_name);

G_END_DECLS
