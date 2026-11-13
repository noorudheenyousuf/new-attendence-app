#!/usr/bin/env python3
"""Patch index.html for Personal Workspace feature"""

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==================================================================
# PATCH 1: Move unread badge from messages button to notification icon
# The unread badge span is inside the messages card button (id unread-msg-badge)
# We already have header-unread-msg-badge in the notification button
# Just make sure header-unread-msg-badge shows count (not just dot)
# ==================================================================
old_header_badge = '<span id="header-unread-msg-badge" class="hidden absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white animate-pulse"></span>'
new_header_badge = '<span id="header-unread-msg-badge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border border-white shadow-sm animate-pulse"></span>'

if old_header_badge in content:
    content = content.replace(old_header_badge, new_header_badge, 1)
    print('PATCH 1 OK: Header badge updated to show count')
else:
    print('PATCH 1 SKIP: header badge not found')

# Remove the bounce badge from the Messages card button (the one inside view-home)
old_msg_badge = '<span id="unread-msg-badge" class="hidden absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-bounce">0</span>'
new_msg_badge = ''  # Remove the badge from messages card completely - it's on header now
if old_msg_badge in content:
    content = content.replace(old_msg_badge, new_msg_badge, 1)
    print('PATCH 1b OK: Removed badge from Messages card button')
else:
    print('PATCH 1b SKIP: messages card badge not found')


# ==================================================================
# PATCH 2: Add Personal Workspace VIEW section (before </main>)
# ==================================================================
workspace_view = '''
      <!-- PERSONAL WORKSPACE VIEW -->
      <section id="view-workspace" class="hidden space-y-0 pb-4">
        <!-- Pink Theme Overlay handled via JS: applyPinkTheme() / revertPinkTheme() -->
      </section>

      <!-- Invisible aliases for backward compatibility -->'''

old_compat = '''      <!-- Invisible aliases for backward compatibility -->'''

if old_compat in content:
    content = content.replace(old_compat, workspace_view, 1)
    print('PATCH 2 OK: Personal Workspace section added')
else:
    print('PATCH 2 SKIP: backward compat comment not found')


# ==================================================================
# PATCH 3: Add 'workspace' to allViews in selectTab (in HTML style script)
# This is done in JS - no HTML change needed
# ==================================================================

# ==================================================================
# PATCH 4: Add pink theme CSS variables to style.css (done separately)
# ==================================================================

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('ALL PATCHES APPLIED TO index.html')
