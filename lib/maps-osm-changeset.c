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

#include "maps-osm-changeset.h"

#include <libxml/xpath.h>

struct _MapsOSMChangesetPrivate
{
  char *comment;
  char *created_by;
};

enum {
  PROP_0,

  PROP_COMMENT,
  PROP_CREATED_BY
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsOSMChangeset, maps_osm_changeset, G_TYPE_OBJECT)

static void
maps_osm_changeset_set_property (GObject      *object,
                                 guint         property_id,
                                 const GValue *value,
                                 GParamSpec   *pspec)
{
  MapsOSMChangeset *changeset = MAPS_OSMCHANGESET (object);

  switch (property_id)
    {
    case PROP_COMMENT:
      changeset->priv->comment = g_value_dup_string (value);
      break;

    case PROP_CREATED_BY:
      changeset->priv->created_by = g_value_dup_string (value);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
    }
}

static void
maps_osm_changeset_get_property (GObject    *object,
                                 guint       property_id,
                                 GValue     *value,
                                 GParamSpec *pspec)
{
  MapsOSMChangeset *changeset = MAPS_OSMCHANGESET (object);

  switch (property_id)
    {
    case PROP_COMMENT:
      g_value_set_string (value, changeset->priv->comment);
      break;

    case PROP_CREATED_BY:
      g_value_set_string (value, changeset->priv->created_by);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
    }
}

static void
maps_osm_changeset_dispose (GObject *object)
{
  MapsOSMChangeset *changeset = MAPS_OSMCHANGESET (object);

  g_free (changeset->priv->comment);
  g_free (changeset->priv->created_by);

  G_OBJECT_CLASS (maps_osm_changeset_parent_class)->dispose (object);
}

static void
maps_osm_changeset_class_init (MapsOSMChangesetClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  object_class->dispose = maps_osm_changeset_dispose;
  object_class->get_property = maps_osm_changeset_get_property;
  object_class->set_property = maps_osm_changeset_set_property;

  /**
   * MapsOSMChangeset:comment:
   *
   * The comment of the changes.
   */
  pspec = g_param_spec_string ("comment",
                               "Comment",
                               "Comment",
                               NULL,
                               G_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_COMMENT, pspec);

  /**
   * MapsOSMChangeset:created_by:
   *
   * The identifier of the client making the changeset.
   */
  pspec = g_param_spec_string ("created_by",
                               "Created by",
                               "Created by",
                               NULL,
                               G_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_CREATED_BY, pspec);
}

static void
maps_osm_changeset_init (MapsOSMChangeset *changeset)
{
  changeset->priv = maps_osm_changeset_get_instance_private (changeset);

  changeset->priv->comment = NULL;
  changeset->priv->created_by = NULL;
}

MapsOSMChangeset *
maps_osm_changeset_new (const char *comment, const char *created_by)
{
  return g_object_new (MAPS_TYPE_OSMCHANGESET,
                       "comment", comment,
                       "created_by", created_by, NULL);
}

xmlNodePtr
maps_osm_changeset_create_tag_node (const char *key, const char * value)
{
  xmlNodePtr node;

  node = xmlNewNode (NULL, (xmlChar *) "tag");
  xmlNewProp (node, (xmlChar *) "k", (xmlChar *) key);
  xmlNewProp (node, (xmlChar *) "v", (xmlChar *) value);

  return node;
}

char *
maps_osm_changeset_serialize (const MapsOSMChangeset *changeset)
{
  xmlDocPtr doc;
  xmlNodePtr osm_node;
  xmlNodePtr changeset_node;
  xmlNodePtr comment_node;
  xmlNodePtr created_by_node;
  xmlChar *result;
  int size;

  doc = xmlNewDoc ((xmlChar *) "1.0");
  osm_node = xmlNewNode (NULL, (xmlChar *) "osm");
  changeset_node = xmlNewNode (NULL, (xmlChar *) "changeset");
  comment_node =
    maps_osm_changeset_create_tag_node ("comment", changeset->priv->comment);
  created_by_node =
    maps_osm_changeset_create_tag_node ("created_by",
                                        changeset->priv->created_by);
  xmlAddChild (osm_node, changeset_node);
  xmlAddChild (changeset_node, comment_node);
  xmlAddChild (changeset_node, created_by_node);
  xmlDocSetRootElement (doc, osm_node);

  xmlDocDumpMemory (doc, &result, &size);
  xmlFreeDoc (doc);

  return (char *) result;
}
