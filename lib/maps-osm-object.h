/*
 * Copyright (c) 2015 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

#ifndef __MAPS_OSM_OBJECT_H__
#define __MAPS_OSM_OBJECT_H__

#include <glib-object.h>
#include <libxml/xpath.h>

#define MAPS_TYPE_OSMOBJECT maps_osm_object_get_type ()
G_DECLARE_DERIVABLE_TYPE(MapsOSMObject, maps_osm_object, MAPS, OSMOBJECT,
			 GObject)

typedef struct _MapsOSMObjectPrivate MapsOSMObjectPrivate;

struct _MapsOSMObjectClass
{
  GObjectClass parent_class;

  /* return the name of the distinguishing OSM XML tag (beneath <osm/>) */
  const char * (* get_xml_tag_name) (void);

  /* return hash table with XML attributes (key/values) specific for
     the object (on the XML tag beneath <osm/>) */
  GHashTable * (* get_xml_attributes) (const MapsOSMObject *object);

  /* return a list of custom object-specific XML tags to attach,
     can return NULL if there's no object-specific nodes */
  xmlNodePtr (* get_xml_child_nodes) (const MapsOSMObject *object);
};

const char *maps_osm_object_get_tag (const MapsOSMObject *object,
                                     const char *key);
void maps_osm_object_set_tag (MapsOSMObject *object, const char *key,
                              const char *value);
void maps_osm_object_delete_tag (MapsOSMObject *object, const char *key);

char *maps_osm_object_serialize (const MapsOSMObject *object);

const GHashTable *maps_osm_object_get_tags (const MapsOSMObject *object);

#endif //__MAPS_OSM_OBJECT_H__
