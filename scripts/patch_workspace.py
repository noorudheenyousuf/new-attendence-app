with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = '          <div id="dash-events-container" class="space-y-2">\n            <!-- Populated via loadHomeDashboard() -->\n          </div>\n        </div>\n\n      </section>\n\n      <!-- 1. ATTENDANCE VIEW -->'

new = '          <div id="dash-events-container" class="space-y-2">\n            <!-- Populated via loadHomeDashboard() -->\n          </div>\n        </div>\n\n        <!-- 7. PERSONAL WORKSPACE BUTTON -->\n        <button type="button" onclick="openPersonalWorkspace()" id="btn-personal-workspace"\n          class="touch-btn w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-700 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/20 hover:from-pink-100 hover:to-rose-100 transition active:scale-98 group">\n          <div class="flex items-center gap-3">\n            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-md group-hover:scale-105 transition flex-shrink-0">\n              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>\n            </div>\n            <div class="text-left">\n              <div class="text-sm font-black text-pink-700 dark:text-pink-300">Personal Workspace</div>\n              <div class="text-[10px] text-pink-500 dark:text-pink-400 font-semibold">Your private corner &bull; Classes, Subjects &amp; Students</div>\n            </div>\n          </div>\n          <svg class="w-4 h-4 text-pink-400 group-hover:translate-x-0.5 transition flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>\n        </button>\n\n      </section>\n\n      <!-- 1. ATTENDANCE VIEW -->'

if old in content:
    content = content.replace(old, new, 1)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Personal Workspace button added to dashboard')
else:
    print('NOT FOUND: Check the exact text')
