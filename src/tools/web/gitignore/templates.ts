/**
 * .gitignore templates, kept short: what each stack generates (dependencies, builds, caches,
 * local config and secrets), not every file a tool ever wrote.
 */

export type TemplateGroup = "language" | "framework" | "tool" | "os" | "editor";

export interface Template {
  id: string;
  name: string;
  group: TemplateGroup;
  /** Extra search words. */
  aliases?: string;
  body: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "node",
    name: "Node.js",
    group: "language",
    aliases: "javascript typescript npm yarn pnpm js ts",
    body: `# Dependencies
node_modules/
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.log

# Builds and caches
dist/
build/
coverage/
.nyc_output/
.cache/
.parcel-cache/
.eslintcache
.stylelintcache
*.tsbuildinfo
.turbo/

# Environment
.env
.env.*
!.env.example`,
  },
  {
    id: "bun",
    name: "Bun",
    group: "language",
    aliases: "javascript typescript",
    body: `node_modules/
dist/
out/
coverage/
*.lcov
*.tgz
*.tsbuildinfo
.cache/
.env
.env.*
!.env.example
*.log`,
  },
  {
    id: "python",
    name: "Python",
    group: "language",
    aliases: "pip venv poetry uv django flask",
    body: `# Bytecode
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
.venv/
venv/
env/
.python-version

# Packaging
build/
dist/
*.egg-info/
.eggs/
wheels/
*.whl

# Tests and tools
.pytest_cache/
.tox/
.nox/
.coverage
.coverage.*
htmlcov/
.mypy_cache/
.ruff_cache/
.pyre/
.hypothesis/

# Environment
.env
.env.*
!.env.example`,
  },
  {
    id: "jupyter",
    name: "Jupyter",
    group: "tool",
    aliases: "notebook ipynb data science",
    body: `.ipynb_checkpoints/
*/.ipynb_checkpoints/*
profile_default/
ipython_config.py`,
  },
  {
    id: "go",
    name: "Go",
    group: "language",
    aliases: "golang",
    body: `# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
/bin/

# Tests
*.test
*.out
coverage.*

# Workspaces
go.work
go.work.sum

.env`,
  },
  {
    id: "rust",
    name: "Rust",
    group: "language",
    aliases: "cargo",
    body: `/target/
**/*.rs.bk
*.pdb
# Cargo.lock is meant to be committed, for applications and libraries alike.`,
  },
  {
    id: "java",
    name: "Java",
    group: "language",
    aliases: "maven jvm",
    body: `*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
replay_pid*

# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
release.properties
.mvn/wrapper/maven-wrapper.jar`,
  },
  {
    id: "gradle",
    name: "Kotlin / Gradle",
    group: "language",
    aliases: "kotlin gradle jvm kts",
    body: `.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar
!**/src/main/**/build/
!**/src/test/**/build/
.kotlin/
*.class
local.properties`,
  },
  {
    id: "android",
    name: "Android",
    group: "framework",
    aliases: "kotlin gradle mobile",
    body: `.gradle/
build/
captures/
.externalNativeBuild/
.cxx/
local.properties
*.apk
*.aab
*.ap_
*.dex
# Signing
*.jks
*.keystore
google-services.json
# Android Studio
*.iml
.idea/
.navigation/
output.json`,
  },
  {
    id: "swift",
    name: "Swift / Xcode",
    group: "language",
    aliases: "ios macos apple cocoapods spm objective-c",
    body: `# Xcode
build/
DerivedData/
*.xcuserstate
xcuserdata/
*.xcscmblueprint
*.xccheckout
*.moved-aside
*.hmap
*.ipa
*.dSYM.zip
*.dSYM

# Swift Package Manager
.build/
.swiftpm/
Packages/

# CocoaPods / Carthage
Pods/
Carthage/Build/

# fastlane
fastlane/report.xml
fastlane/Preview.html
fastlane/screenshots/**/*.png
fastlane/test_output`,
  },
  {
    id: "flutter",
    name: "Flutter / Dart",
    group: "framework",
    aliases: "dart mobile",
    body: `.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/
# Platform folders
ios/Pods/
ios/.symlinks/
ios/Flutter/Generated.xcconfig
ios/Flutter/flutter_export_environment.sh
android/.gradle/
android/local.properties
android/key.properties
*.jks`,
  },
  {
    id: "c",
    name: "C / C++",
    group: "language",
    aliases: "cpp cmake make gcc clang",
    body: `# Objects and libraries
*.o
*.obj
*.ko
*.elf
*.a
*.lib
*.so
*.so.*
*.dylib
*.dll
*.gch
*.pch

# Executables
*.exe
*.out
*.app

# Debug
*.dSYM/
*.su
*.idb
*.pdb

# CMake
build/
cmake-build-*/
CMakeFiles/
CMakeCache.txt
cmake_install.cmake
compile_commands.json
.cache/`,
  },
  {
    id: "dotnet",
    name: ".NET / C#",
    group: "language",
    aliases: "csharp c# fsharp visual studio nuget",
    body: `[Bb]in/
[Oo]bj/
[Dd]ebug/
[Rr]elease/
[Ll]og/
*.user
*.suo
*.userosscache
*.sln.docstates
.vs/
*.nupkg
*.snupkg
packages/
project.lock.json
artifacts/
TestResults/
*.trx`,
  },
  {
    id: "ruby",
    name: "Ruby / Rails",
    group: "language",
    aliases: "rails gem bundler",
    body: `*.gem
*.rbc
/.bundle/
/vendor/bundle
/log/*
/tmp/*
!/log/.keep
!/tmp/.keep
/storage/*
!/storage/.keep
/public/assets
/coverage/
/spec/reports/
.byebug_history
.rspec_status
/config/master.key
/config/credentials/*.key
.env`,
  },
  {
    id: "php",
    name: "PHP / Composer",
    group: "language",
    aliases: "composer laravel symfony",
    body: `/vendor/
composer.phar
.phpunit.result.cache
.phpunit.cache/
.php-cs-fixer.cache
.php_cs.cache
phpstan.neon.local
# Laravel / Symfony
/storage/*.key
/var/
/public/hot
/public/storage
.env
.env.*
!.env.example`,
  },
  {
    id: "nextjs",
    name: "Next.js",
    group: "framework",
    aliases: "react vercel node",
    body: `/node_modules
/.next/
/out/
/build
.vercel
next-env.d.ts
*.tsbuildinfo
.env*.local
.env
npm-debug.log*
yarn-debug.log*
yarn-error.log*`,
  },
  {
    id: "vite",
    name: "Vite / Vue / Svelte",
    group: "framework",
    aliases: "vue svelte sveltekit nuxt astro react",
    body: `node_modules/
dist/
dist-ssr/
*.local
.svelte-kit/
.nuxt/
.output/
.astro/
.vite/
.env
.env.*
!.env.example`,
  },
  {
    id: "terraform",
    name: "Terraform",
    group: "tool",
    aliases: "opentofu hcl iac infrastructure",
    body: `.terraform/
*.tfstate
*.tfstate.*
crash.log
crash.*.log
*.tfvars
*.tfvars.json
!example.tfvars
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc
*.tfplan`,
  },
  {
    id: "docker",
    name: "Docker",
    group: "tool",
    aliases: "compose container",
    body: `# Local overrides and data volumes
docker-compose.override.yml
compose.override.yaml
.env`,
  },
  {
    id: "unity",
    name: "Unity",
    group: "framework",
    aliases: "game c# gamedev",
    body: `/[Ll]ibrary/
/[Tt]emp/
/[Oo]bj/
/[Bb]uild/
/[Bb]uilds/
/[Ll]ogs/
/[Uu]ser[Ss]ettings/
/[Mm]emoryCaptures/
/[Rr]ecordings/
/[Aa]ssets/Plugins/Editor/JetBrains*
.vs/
.vsconfig
*.csproj
*.unityproj
*.sln
*.suo
*.user
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db
*.apk
*.aab
*.unitypackage
crashlytics-build.properties
/[Aa]ssets/[Ss]treamingAssets/aa/*`,
  },
  {
    id: "macos",
    name: "macOS",
    group: "os",
    aliases: "mac apple finder ds_store",
    body: `.DS_Store
.AppleDouble
.LSOverride
._*
.Spotlight-V100
.Trashes
.fseventsd
.DocumentRevisions-V100
.TemporaryItems
.VolumeIcon.icns
.com.apple.timemachine.donotpresent`,
  },
  {
    id: "windows",
    name: "Windows",
    group: "os",
    aliases: "thumbs.db desktop.ini",
    body: `Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
desktop.ini
$RECYCLE.BIN/
*.stackdump
*.lnk
*.cab
*.msix
*.msm
*.msp`,
  },
  {
    id: "linux",
    name: "Linux",
    group: "os",
    aliases: "unix",
    body: `*~
.fuse_hidden*
.directory
.Trash-*
.nfs*`,
  },
  {
    id: "vscode",
    name: "VS Code",
    group: "editor",
    aliases: "visual studio code vscodium cursor",
    body: `.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
!.vscode/*.code-snippets
.history/
*.vsix`,
  },
  {
    id: "jetbrains",
    name: "JetBrains IDEs",
    group: "editor",
    aliases: "intellij webstorm pycharm phpstorm goland rider android studio idea",
    body: `.idea/
*.iml
*.ipr
*.iws
out/
.idea_modules/
atlassian-ide-plugin.xml
.fleet/`,
  },
  {
    id: "vim",
    name: "Vim / Emacs",
    group: "editor",
    aliases: "neovim nvim emacs swap",
    body: `# Vim
[._]*.s[a-v][a-z]
!*.svg
[._]*.sw[a-p]
[._]s[a-rt-v][a-z]
[._]ss[a-gi-z]
[._]sw[a-p]
Session.vim
Sessionx.vim
.netrwhist
tags
[._]*.un~

# Emacs
*~
\\#*\\#
/.emacs.desktop
/.emacs.desktop.lock
*.elc
auto-save-list
.\\#*
.projectile
.dir-locals-2.el`,
  },
  {
    id: "secrets",
    name: "Secrets & keys",
    group: "tool",
    aliases: "env credentials pem key ssh security",
    body: `.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
id_rsa*
id_ed25519*
.secrets/
secrets.*
credentials.json
service-account*.json`,
  },
  {
    id: "logs",
    name: "Logs & temp files",
    group: "tool",
    aliases: "tmp temporary cache backup",
    body: `*.log
logs/
tmp/
temp/
*.tmp
*.temp
*.bak
*.swp
*.orig
*.rej`,
  },
];
