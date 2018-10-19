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

#include "maps-osm-relation.h"

struct _MapsOSMRelationPrivate
{
  GList *members;
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsOSMRelation, maps_osm_relation,
                            MAPS_TYPE_OSMOBJECT);

typedef struct
{
  char *role;
  guint type;
  guint64 ref;
} MapsOSMRelationMember;

static void
maps_osm_relation_member_free (gpointer data)
{
  MapsOSMRelationMember *member = (MapsOSMRelationMember *) data;

  g_free (member->role);
}

static void
maps_osm_relation_dispose (GObject *object)
{
  MapsOSMRelation *relation = MAPS_OSMRELATION (object);

  g_list_free_full (relation->priv->members, maps_osm_relation_member_free);
  relation->priv->members = NULL;

  G_OBJECT_CLASS (maps_osm_relation_parent_class)->dispose (object);
}

static const char *
maps_osm_relation_get_xml_tag_name (void)
{
  return "relation";
}

static const char *
maps_osm_relation_member_type_to_string (guint type)
{
  switch (type) {
  case MEMBER_TYPE_NODE:
    return "node";
  case MEMBER_TYPE_WAY:
    return "way";
  case MEMBER_TYPE_RELATION:
    return "relation";
  default:
    g_warning ("Unknown relation member type: %d\n", type);
    return NULL;
  }
}

static xmlNodePtr
maps_osm_relation_get_member_node (const MapsOSMRelationMember *member)
{
  xmlNodePtr node = xmlNewNode (NULL, (xmlChar *) "member");
  char buf[16];
  
  if (member->role)
    xmlNewProp (node, (xmlChar *) "role", (xmlChar *) g_strdup (member->role));

  xmlNewProp (node, (xmlChar *) "type",
              (xmlChar *) maps_osm_relation_member_type_to_string (member->type));
  g_snprintf (buf, 16, "%" G_GUINT64_FORMAT, member->ref);
  xmlNewProp (node, (xmlChar *) "ref", (xmlChar *) buf);

  return node;
}

static xmlNodePtr
maps_osm_relation_get_xml_child_nodes (const MapsOSMObject *object)
{
  MapsOSMRelation *relation = MAPS_OSMRELATION ((MapsOSMObject *) object);
  xmlNodePtr nodes = NULL;
  const GList *members = relation->priv->members;
  
  if (members)
    {
      const GList *iter;
      nodes = maps_osm_relation_get_member_node ((MapsOSMRelationMember *)
                                                 members->data);

      for (iter = members->next; iter; iter = iter->next)
        {
          xmlAddSibling (nodes, maps_osm_relation_get_member_node (
            (MapsOSMRelationMember *) iter->data));
        }
    }

  return nodes;
}

static void
maps_osm_relation_class_init (MapsOSMRelationClass *klass)
{
  GObjectClass *relation_class = G_OBJECT_CLASS (klass);
  MapsOSMObjectClass *object_class = MAPS_OSMOBJECT_CLASS (klass);

  relation_class->dispose = maps_osm_relation_dispose;
  object_class->get_xml_tag_name = maps_osm_relation_get_xml_tag_name;
  object_class->get_xml_child_nodes = maps_osm_relation_get_xml_child_nodes;
}

static void
maps_osm_relation_init (MapsOSMRelation *relation)
{
  relation->priv = maps_osm_relation_get_instance_private (relation);
}

MapsOSMRelation *
maps_osm_relation_new (guint64 id, guint version, guint64 changeset)
{
  return g_object_new (MAPS_TYPE_OSMRELATION,
                       "id", id,
                       "version", version,
                       "changeset", changeset, NULL);
}

void
maps_osm_relation_add_member (MapsOSMRelation *relation, const gchar *role,
                              guint type, guint64 ref)
{
  MapsOSMRelationMember *member = g_new (MapsOSMRelationMember, 1);

  member->role = g_strdup (role);
  member->type = type;
  member->ref = ref;

  relation->priv->members = g_list_append (relation->priv->members, member);
}

