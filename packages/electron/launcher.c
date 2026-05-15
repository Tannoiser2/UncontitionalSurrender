#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <libgen.h>
#include <mach-o/dyld.h>

int main(int argc, char *argv[]) {
    char self[4096];
    uint32_t size = sizeof(self);
    if (_NSGetExecutablePath(self, &size) != 0) {
        fprintf(stderr, "Cannot get executable path\n");
        return 1;
    }

    // self = .../Contents/MacOS/Unconditional Surrender
    // parent of parent = .../Contents
    char *macos_dir = dirname(self);
    char contents[4096];
    snprintf(contents, sizeof(contents), "%s/..", macos_dir);

    char electron[4096];
    snprintf(electron, sizeof(electron),
        "%s/Resources/Electron.app/Contents/MacOS/Electron", contents);

    char app_dir[4096];
    snprintf(app_dir, sizeof(app_dir),
        "%s/Resources/app", contents);

    // Pass --no-sandbox to prevent GPU process sandbox crash on macOS Sequoia
    // then app_dir, then any extra args
    char **args = malloc((argc + 5) * sizeof(char *));
    args[0] = electron;
    args[1] = "--no-sandbox";
    args[2] = "--disable-gpu-sandbox";
    args[3] = app_dir;
    for (int i = 1; i < argc; i++) args[i + 3] = argv[i];
    args[argc + 3] = NULL;

    execv(electron, args);
    perror("execv failed");
    return 1;
}
