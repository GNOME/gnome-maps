/*
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

#define MAPS_TYPE_CONTACT            (maps_contact_get_type ())
#define MAPS_CONTACT(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_CONTACT, MapsContact))
#define MAPS_IS_CONTACT(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_CONTACT))
#define MAPS_CONTACT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_CONTACT, MapsContactClass))
#define MAPS_IS_CONTACT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_CONTACT))
#define MAPS_CONTACT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_CONTACT, MapsContactClass))

typedef struct _MapsContact        MapsContact;
typedef struct _MapsContactClass   MapsContactClass;
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

GType        maps_contact_get_type   (void);
MapsContact *maps_contact_new        (void);
void         maps_contact_add_place  (MapsContact               *contact,
                                      GeocodePlace              *place);
GList *      maps_contact_get_places (MapsContact               *contact);
void         maps_contact_geocode    (MapsContact               *contact,
                                      MapsContactGeocodeCallback callback);
#endif
