/*
 * Copyright (c) 2015 Jonas Danielsson
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

#ifndef __MAPS_CONTACT_H__
#define __MAPS_CONTACT_H__

#include <glib-object.h>
#include <geocode-glib/geocode-glib.h>

#define MAPS_TYPE_CONTACT maps_contact_get_type ()
G_DECLARE_FINAL_TYPE(MapsContact, maps_contact, MAPS, CONTACT, GObject)

typedef struct _MapsContactPrivate MapsContactPrivate;

/**
 * MapsContactGeocodeCallback:
 * @contact: A #MapsContact object
 */
typedef void (*MapsContactGeocodeCallback) (MapsContact *contact);

struct _MapsContact
{
  GObject parent_instance;
  MapsContactPrivate *priv;
};

struct _MapsContactClass
{
  GObjectClass parent_class;
};

MapsContact *maps_contact_new        (void);
void         maps_contact_add_place  (MapsContact               *contact,
                                      GeocodePlace              *place);
GList *      maps_contact_get_places (MapsContact               *contact);
void         maps_contact_geocode    (MapsContact               *contact,
                                      MapsContactGeocodeCallback callback);
#endif
