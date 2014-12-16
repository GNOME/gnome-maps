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

#ifndef __MAPS_CONTACT_STORE_H__
#define __MAPS_CONTACT_STORE_H__

#include <glib-object.h>
#include "maps-contact.h"

#define MAPS_TYPE_CONTACT_STORE maps_contact_store_get_type ()
G_DECLARE_FINAL_TYPE(MapsContactStore, maps_contact_store, MAPS, CONTACT_STORE,
                     GObject)

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

MapsContactStore * maps_contact_store_new          (void);
void               maps_contact_store_load         (MapsContactStore              *store);
void               maps_contact_store_lookup       (MapsContactStore              *store,
                                                    const char                    *id,
                                                    MapsContactStoreLookupCallback callback);
GList *            maps_contact_store_get_contacts (MapsContactStore *store);

#endif
