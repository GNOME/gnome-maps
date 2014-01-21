/* -*- Mode: C; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
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
 * Author: Florian Müllner <fmuellner@gnome.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

#include "config.h"

#include <girepository.h>
#include <gjs/gjs.h>

int
main (int argc, char *argv)
{
  const char *search_path[] = { "resource:///org/gnome/maps", NULL };
  GError *error = NULL;
  GjsContext *context;
  int status;

  bindtextdomain (GETTEXT_PACKAGE, LOCALEDIR);
  bind_textdomain_codeset (GETTEXT_PACKAGE, "UTF-8");
  textdomain (GETTEXT_PACKAGE);

  g_irepository_prepend_search_path (GNOME_MAPS_PKGLIBDIR);

  context = gjs_context_new_with_search_path (search_path);

  if (!gjs_context_define_string_array(context, "ARGV",
                                       argc - 1, (const char**)argv + 1,
                                       &error))
    {
      g_critical ("Failed to defined ARGV: %s", error->message);
      g_error_free (error);

      return 1;
    }


  if (!gjs_context_eval (context,
                         "const Main = imports.main; Main.start();",
                         -1,
                         "<main>",
                         &status,
                         &error))
    {
      g_critical (error->message);
      g_error_free (error);

      return status;
    }

  return 0;
}
