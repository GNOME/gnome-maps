/*
 * Copyright (c) 2023 James Westman
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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>
 *
 * Author: James Westman <james@jwestman.net>
 */

#pragma once

#include <shumate/shumate.h>

G_BEGIN_DECLS

#define MAPS_TYPE_SPRITE_SOURCE (maps_sprite_source_get_type())
G_DECLARE_FINAL_TYPE (MapsSpriteSource, maps_sprite_source, MAPS, SPRITE_SOURCE, GObject)

MapsSpriteSource *maps_sprite_source_new (void);

void maps_sprite_source_set_fallback (MapsSpriteSource *self, ShumateVectorSpriteSheet *sprite_sheet);

G_END_DECLS
