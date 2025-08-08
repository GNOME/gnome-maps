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

#include "maps-osm.h"
#include "mapsintl.h"

#include <libxml/parser.h>
#include <libxml/xpath.h>

#define MAPS_OSM_ERROR maps_osm_error_quark ()

GQuark
maps_osm_error_quark (void)
{
  return g_quark_from_static_string ("maps-osm-error");
}

void
maps_osm_init (void)
{
  LIBXML_TEST_VERSION;
}

void
maps_osm_finalize (void)
{
  xmlCleanupParser ();
}

static xmlDocPtr
read_xml_doc (const char *content, guint length, GError **error)
{
  xmlDoc *doc;

  doc = xmlReadMemory (content, length, "noname.xml", NULL, 0);

  if (!doc)
    {
      *error = g_error_new_literal (MAPS_OSM_ERROR, 0,
                                    _("Failed to parse XML document"));
      return NULL;
    }

  return doc;
}

static void
parse_tag (const xmlAttr *attrs, GHashTable *tags)
{
  const xmlAttr *cur_attr;
  char *key;
  char *value;

  key = NULL;
  value = NULL;

  for (cur_attr = attrs; cur_attr; cur_attr = cur_attr->next)
    {
      if (g_str_equal ((const char *) cur_attr->name, "k"))
        key = (char *) cur_attr->children->content;
      else if (g_str_equal ((const char *) cur_attr->name, "v"))
        value = (char *) cur_attr->children->content;
      else
        g_warning ("Unexpected tag property: %s\n", cur_attr->name);
    }

  g_hash_table_insert (tags, key, value);
}

static GHashTable *
parse_attributes (const xmlNode *node)
{
  GHashTable *attributes;
  const xmlAttr *cur_attr;
  
  attributes = g_hash_table_new (g_str_hash, g_str_equal);

  for (cur_attr = node->properties; cur_attr; cur_attr = cur_attr->next)
    {
      g_hash_table_insert (attributes,
                           (gpointer) cur_attr->name,
                           (gpointer) cur_attr->children->content);
    }

  return attributes;
}

static GHashTable *
parse_tags (const xmlNode *tag_child)
{
  GHashTable *tags;
  const xmlNode *cur_node;
  
  tags = g_hash_table_new (g_str_hash, g_str_equal);

  for (cur_node = tag_child; cur_node; cur_node = cur_node->next)
    {
      /* skip non-element nodes */
      if (cur_node->type != XML_ELEMENT_NODE)
        continue;

      if (g_str_equal ((const char *) cur_node->name, "tag"))
        parse_tag (cur_node->properties, tags);
    }

  return tags;
}

static GArray *
parse_node_refs (const xmlNode *node_ref_child)
{
  GArray *node_refs;
  const xmlNode *cur_node;

  node_refs = g_array_new (FALSE, FALSE, sizeof (guint64));

  for (cur_node = node_ref_child; cur_node; cur_node = cur_node->next)
    {
      /* skip non-element nodes */
      if (cur_node->type != XML_ELEMENT_NODE)
        continue;

      if (g_str_equal ((const char *) cur_node->name, "nd"))
        {
          char *ref;
          GHashTable *attributes;

          attributes = parse_attributes (cur_node);
          ref = g_hash_table_lookup (attributes, "ref");

          if (ref)
            {
              guint64 id = g_ascii_strtoull (ref, NULL, 10);

              if (id == 0)
                g_warning ("Invalid node ref: %s", ref);
              else
                g_array_append_val (node_refs, id);
            }

          g_hash_table_destroy (attributes);
        }
    }

  return node_refs;
}

static xmlNode *
get_sub_node (xmlDoc *doc)
{
  xmlNode *node;
  xmlXPathContext *xpath_ctx;
  xmlXPathObject * xpath_obj;

  xpath_ctx = xmlXPathNewContext (doc);
  xpath_obj = xmlXPathEvalExpression ((xmlChar *)
                                      "/osm/node|/osm/way|/osm/relation|/osm/user",
                                      xpath_ctx);

  if (xpath_obj && xpath_obj->nodesetval && xpath_obj->nodesetval->nodeNr > 0)
    {
      node = xmlCopyNode (xpath_obj->nodesetval->nodeTab[0], 1);
    }
  else
    {
      g_warning ("Couldn't find element");
      node = NULL;
    }

  xmlXPathFreeObject (xpath_obj);
  xmlXPathFreeContext (xpath_ctx);

  return node;
}

static void
for_each_tag (gpointer key, gpointer value, gpointer user_data)
{
  const char *k = (const char *) key;
  const char *v = (const char *) value;
  MapsOSMObject *object = MAPS_OSMOBJECT (user_data);

  maps_osm_object_set_tag (object, k, v);
}

static void
fill_tags (MapsOSMObject *object, GHashTable *tags)
{
  g_hash_table_foreach (tags, for_each_tag, object);
}

static void
fill_node_ref_list (MapsOSMWay *way, const GArray *node_refs)
{
  int i;
  
  for (i = 0; i < node_refs->len; i++)
    {
      maps_osm_way_add_node_id (way, g_array_index (node_refs, guint64, i));
    }
}

static MapsOSMNode *
parse_node (const xmlNodePtr node, GError **error)
{
  const char *id_string;
  guint64 id;
  const char *changeset_string;
  guint64 changeset;
  const char *version_string;
  guint version;
  const char *lat_string;
  double lat;
  const char *lon_string;
  double lon;
  
  GHashTable *tags;
  GHashTable *attributes;

  MapsOSMNode *result;

  attributes = parse_attributes (node);

  id_string = g_hash_table_lookup (attributes, "id");
  changeset_string = g_hash_table_lookup (attributes, "changeset");
  version_string = g_hash_table_lookup (attributes, "version");
  lat_string = g_hash_table_lookup (attributes, "lat");
  lon_string = g_hash_table_lookup (attributes, "lon");

  if (!id_string || !changeset_string || !version_string
      || !lat_string || !lon_string)
    {
      *error = g_error_new_literal (MAPS_OSM_ERROR, 0,
                                    _("Missing required attributes"));
      g_hash_table_destroy (attributes);
      return NULL;
    }

  id = g_ascii_strtoull (id_string, NULL, 10);
  changeset = g_ascii_strtoull (changeset_string, NULL, 10);
  version = g_ascii_strtoull (version_string, NULL, 10);
  lon = g_ascii_strtod (lon_string, NULL);
  lat = g_ascii_strtod (lat_string, NULL);

  g_hash_table_destroy (attributes);

  result = maps_osm_node_new (id, version, changeset, lon, lat);

  tags = parse_tags (node->children);
  fill_tags (MAPS_OSMOBJECT (result), tags);

  g_hash_table_destroy (tags);

  return result;
}

static MapsOSMWay *
parse_way (const xmlNodePtr way, GError **error)
{
  GHashTable *attributes;
  GHashTable *tags;
  GArray *node_refs;
  MapsOSMWay *result;

  const char *id_string;
  guint64 id;
  const char *changeset_string;
  guint64 changeset;
  const char *version_string;
  guint version;

  attributes = parse_attributes (way);

  id_string = g_hash_table_lookup (attributes, "id");
  changeset_string = g_hash_table_lookup (attributes, "changeset");
  version_string = g_hash_table_lookup (attributes, "version");

  if (!id_string || !changeset_string || !version_string)
    {
      g_warning ("Missing required attributes\n");
      g_hash_table_destroy (attributes);
      return NULL;
    }

  g_hash_table_destroy (attributes);

  id = g_ascii_strtoull (id_string, NULL, 10);
  changeset = g_ascii_strtoull (changeset_string, NULL, 10);
  version = g_ascii_strtoull (version_string, NULL, 10);

  result = maps_osm_way_new (id, version, changeset);

  tags = parse_tags (way->children);
  fill_tags (MAPS_OSMOBJECT (result), tags);
  g_hash_table_destroy (tags);

  node_refs = parse_node_refs (way->children);
  fill_node_ref_list (result, node_refs);
  g_array_free (node_refs, TRUE);

  return result;
}


static GList *
parse_members (const xmlNode *member_child)
{
  const xmlNode *cur_node;
  GList *members;

  members = NULL;

  for (cur_node = member_child; cur_node; cur_node = cur_node->next)
    {
      /* skip non-element nodes */
      if (cur_node->type != XML_ELEMENT_NODE)
        continue;

      if (g_str_equal ((const char *) cur_node->name, "member"))
        {
          GHashTable *attributes;

          attributes = parse_attributes (cur_node);
          members = g_list_append (members, attributes);
        }
    }
  
  return members;
}

static void
fill_members (MapsOSMRelation *relation, const GList *members)
{
  const GList *cur;

  for (cur = members; cur; cur = g_list_next (cur)) {
    GHashTable *attributes = (GHashTable *) cur->data;
    const char *type_string = g_hash_table_lookup (attributes, "type");
    guint type;
    const char *role = g_hash_table_lookup (attributes, "role");
    const char *ref_string = g_hash_table_lookup (attributes, "ref");
    guint64 ref = 0;

    if (ref_string)
      ref = g_ascii_strtoull (ref_string, NULL, 10);

    if (g_strcmp0 (type_string, "node") == 0)
      type = MEMBER_TYPE_NODE;
    else if (g_strcmp0 (type_string, "way") == 0)
      type = MEMBER_TYPE_WAY;
    else if (g_strcmp0 (type_string, "relation") == 0)
      type = MEMBER_TYPE_RELATION;
    else
      {
        g_warning ("Unknown relation type: %s\n", type_string);
        continue;
      }
    
    maps_osm_relation_add_member (relation, role, type, ref);
  }
}

static MapsOSMRelation *
parse_relation (const xmlNodePtr relation, GError **error)
{
  GHashTable *attributes;
  GHashTable *tags;
  GList *member_list;

  const char *id_string;
  guint64 id;
  const char *changeset_string;
  guint64 changeset;
  const char *version_string;
  guint version;
  
  MapsOSMRelation *result;

  attributes = parse_attributes (relation);
  id_string = g_hash_table_lookup (attributes, "id");
  changeset_string = g_hash_table_lookup (attributes, "changeset");
  version_string = g_hash_table_lookup (attributes, "version");

  if (!id_string || !changeset_string || !version_string)
    {
      *error = g_error_new_literal (MAPS_OSM_ERROR, 0,
                                    _("Missing required attributes"));
      g_hash_table_destroy (attributes);
      return NULL;
    }

  g_hash_table_destroy (attributes);

  id = g_ascii_strtoull (id_string, NULL, 10);
  changeset = g_ascii_strtoull (changeset_string, NULL, 10);
  version = g_ascii_strtoull (version_string, NULL, 10);

  result = maps_osm_relation_new (id, version, changeset);

  tags = parse_tags (relation->children);
  fill_tags (MAPS_OSMOBJECT (result), tags);
  g_hash_table_destroy (tags);

  member_list = parse_members (relation->children);
  fill_members (result, member_list);
  g_list_free_full (member_list, (GDestroyNotify) g_hash_table_destroy);

  return result;
}

/**
 * maps_osm_parse:
 * @content: XML data
 * @length: Length of data
 * @error: Error handle
 * Returns: (transfer full): A MapsOSMObject
 */
MapsOSMObject *
maps_osm_parse (const char *content, guint length, GError **error)
{
  xmlDocPtr doc;
  xmlNodePtr sub_node;
  MapsOSMObject *object = NULL;

  doc = read_xml_doc (content, length, error);

  if (!doc)
    return NULL;

  sub_node = get_sub_node (doc);

  if (!sub_node)
    {
      *error = g_error_new_literal (MAPS_OSM_ERROR, 0,
                                   _("Could not find OSM element"));
      return NULL;
    }

  if (g_str_equal ((const char *) sub_node->name, "node"))
    {
      object = MAPS_OSMOBJECT (parse_node (sub_node, error));
    }
  else if (g_str_equal ((const char *) sub_node->name, "way"))
    {
      object = MAPS_OSMOBJECT (parse_way (sub_node, error));
    }
  else if (g_str_equal ((const char *) sub_node->name, "relation"))
    {
      object = MAPS_OSMOBJECT (parse_relation (sub_node, error));
    }

  xmlFreeNode (sub_node);
  xmlFreeDoc (doc);

  return object;
}

