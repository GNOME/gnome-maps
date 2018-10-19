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

#include "maps-osm-way.h"

struct _MapsOSMWayPrivate
{
  GArray *node_ids;
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsOSMWay, maps_osm_way, MAPS_TYPE_OSMOBJECT);

static void
maps_osm_way_dispose (GObject *object)
{
  MapsOSMWay *way = MAPS_OSMWAY (object);

  g_array_free (way->priv->node_ids, TRUE);
  way->priv->node_ids = NULL;

  G_OBJECT_CLASS (maps_osm_way_parent_class)->dispose (object);
}

static const char *
maps_osm_way_get_xml_tag_name (void)
{
  return "way";
}

static xmlNodePtr
maps_osm_way_create_node_xml_node (guint64 ref)
{
  xmlNodePtr nd;
  char buf[16];

  g_snprintf (buf, 16, "%" G_GUINT64_FORMAT, ref);
  nd = xmlNewNode (NULL, (xmlChar *) "nd");
  xmlNewProp (nd, (xmlChar *) "ref", (xmlChar *) buf);

  return nd;
}

static xmlNodePtr
maps_osm_way_get_xml_child_nodes(const MapsOSMObject *object)
{
  const MapsOSMWay *way = MAPS_OSMWAY ((MapsOSMObject *) object);
  int i;
  xmlNodePtr result;
  xmlNodePtr next;

  g_return_val_if_fail (way->priv->node_ids->len > 0, NULL);

  result = maps_osm_way_create_node_xml_node (g_array_index (way->priv->node_ids,
                                                             guint64, 0));
  next = result;
  
  for (i = 1; i < way->priv->node_ids->len; i++)
    {
      xmlNodePtr new_node;
      new_node =
        maps_osm_way_create_node_xml_node (g_array_index (way->priv->node_ids,
                                                          guint64, i));
      next = xmlAddNextSibling (next, new_node);
    }

  return result;
}

static void
maps_osm_way_class_init (MapsOSMWayClass *klass)
{
  GObjectClass *way_class = G_OBJECT_CLASS (klass);
  MapsOSMObjectClass *object_class = MAPS_OSMOBJECT_CLASS (klass);
  
  way_class->dispose = maps_osm_way_dispose;
  object_class->get_xml_tag_name = maps_osm_way_get_xml_tag_name;
  object_class->get_xml_child_nodes = maps_osm_way_get_xml_child_nodes;
}

static void
maps_osm_way_init (MapsOSMWay *way)
{
  way->priv = maps_osm_way_get_instance_private (way);
  way->priv->node_ids = g_array_new (FALSE, FALSE, sizeof (guint64));
}

MapsOSMWay *
maps_osm_way_new (guint64 id, guint version, guint64 changeset)
{
  return g_object_new (MAPS_TYPE_OSMWAY,
                       "id", id,
                       "version", version,
                       "changeset", changeset, NULL);
}

void
maps_osm_way_add_node_id (MapsOSMWay *way, guint64 id)
{
  g_array_append_val (way->priv->node_ids, id);
}
