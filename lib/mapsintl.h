#ifndef _MAPS_INTL_H_
#define _MAPS_INTL_H_

#ifdef ENABLE_NLS
#include <libintl.h>
#define _(String) g_dgettext(GETTEXT_PACKAGE "-properties",String)
#else
#define _(String) (String)
#endif

#endif
