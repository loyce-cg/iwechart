#scripts globals
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
MAIN="$(dirname "$DIR")"

MAIN_PROJECT_NAME="main";
SUBMODULES_DIR="modules";

PRIVMX_ELECTRON="${MAIN}/build-tools/privmx-electron"

declare -a modules=(
     "main"
     "modules/apps"
     "modules/chat"
     "modules/editor"
     "modules/notes2"
     "modules/tasks"
     "modules/twofa"
     "modules/calendar"
)

declare -a submodulesExceptCalendar=(
     "modules/apps"
     "modules/chat"
     "modules/editor"
     "modules/notes2"
     "modules/tasks"
     "modules/twofa"
)

declare -a submodulesNames=(
     "apps"
     "chat"
     "editor"
     "notes2"
     "tasks"
     "twofa"
     "calendar"
)
