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

#ifndef __MAPS_CONTACT_STORE_H__
#define __MAPS_CONTACT_STORE_H__

#include <glib-object.h>
#include "maps-contact.h"

#define MAPS_TYPE_CONTACT_STORE            (maps_contact_store_get_type ())
#define MAPS_CONTACT_STORE(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_CONTACT_STORE, MapsContactStore))
#define MAPS_IS_CONTACT_STORE(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_CONTACT_STORE))
#define MAPS_CONTACT_STORE_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_CONTACT_STORE, MapsContactStoreClass))
#define MAPS_IS_CONTACT_STORE_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_CONTACT_STORE))
#define MAPS_CONTACT_STORE_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_CONTACT_STORE, MapsContactStoreClass))

typedef struct _MapsContactStore        MapsContactStore;
typedef struct _MapsContactStoreClass   MapsContactStoreClass;
typedef struct _MapsContactStorePrivate MapsContactStorePrivate;

/**
 * MapsContactStoreState:
 * @MAPS_CONTACT_STORE_STATE_INITIAL: Initial state
 * @MAPS_CONTACT_STORE_STATE_LOADING: Loading
 * @MAPS_CONTACT_STORE_STATE_LOADED: Loaded
 */
typedef enum {
  MAPS_CONTACT_STORE_STATE_INITIAL,
  MAPS_CONTACT_STORE_STATE_LOADING,
  MAPS_CONTACT_STORE_STATE_LOADED,
} MapsContactStoreState;

/**
 * MapsContactStoreLookupCallback:
 * @contact: A #MapsContact object
 */
typedef void (*MapsContactStoreLookupCallback) (MapsContact *contact);

struct _MapsContactStore
{
  GObject parent_instance;
  MapsContactStorePrivate *priv;
};

struct _MapsContactStoreClass
{
  GObjectClass parent_class;
};

GType              maps_contact_store_get_type     (void);
MapsContactStore * maps_contact_store_new          (void);
void               maps_contact_store_load         (MapsContactStore              *store);
void               maps_contact_store_lookup       (MapsContactStore              *store,
                                                    const char                    *id,
                                                    MapsContactStoreLookupCallback callback);
GList *            maps_contact_store_get_contacts (MapsContactStore *store);

#endif
