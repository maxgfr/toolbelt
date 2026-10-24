/** The git memo: tasks grouped by theme, with commands and EN/FR explanations. */

export type GroupId =
  | "setup"
  | "commit"
  | "inspect"
  | "branches"
  | "undo"
  | "stash"
  | "rebase"
  | "remote"
  | "tags"
  | "worktrees"
  | "bisect"
  | "cleanup";

export interface GitTip {
  group: GroupId;
  /** What you want to do ("Undo the last commit, keep the changes"). */
  en: string;
  fr: string;
  /** The command(s), one per line; `<placeholders>` in angle brackets. */
  cmd: string;
  noteEn: string;
  noteFr: string;
  /** Loses work or rewrites shared history if misused. */
  danger?: boolean;
}

type Row = [string, string, string, string, string, boolean?];

const G: Record<GroupId, Row[]> = {
  setup: [
    [
      "Set your name and email",
      "Définir ton nom et ton e-mail",
      'git config --global user.name "Your Name"\ngit config --global user.email you@example.com',
      "Stored in ~/.gitconfig and written into every commit you make.",
      "Enregistrés dans ~/.gitconfig et inscrits dans chaque commit.",
    ],
    [
      "Start a repository",
      "Créer un dépôt",
      "git init\ngit init -b main <folder>",
      "-b sets the name of the first branch.",
      "-b fixe le nom de la première branche.",
    ],
    [
      "Copy a repository",
      "Copier un dépôt",
      "git clone <url>\ngit clone --depth 1 <url>",
      "--depth 1 fetches only the latest commit (faster, no history).",
      "--depth 1 ne récupère que le dernier commit (plus rapide, sans historique).",
    ],
    [
      "Make main the default branch name",
      "Utiliser main comme nom de branche par défaut",
      "git config --global init.defaultBranch main",
      "Applies to repositories created afterwards.",
      "S'applique aux dépôts créés ensuite.",
    ],
    [
      "Create a command alias",
      "Créer un alias de commande",
      'git config --global alias.lg "log --oneline --graph --decorate --all"',
      "Then run git lg.",
      "Ensuite, lance git lg.",
    ],
    [
      "Sign commits with SSH or GPG",
      "Signer les commits avec SSH ou GPG",
      "git config --global gpg.format ssh\ngit config --global user.signingkey ~/.ssh/id_ed25519.pub\ngit config --global commit.gpgsign true",
      "Hosts show signed commits as verified once the key is added to your account.",
      "Les hébergeurs affichent les commits signés comme vérifiés une fois la clé ajoutée au compte.",
    ],
    [
      "See where a setting comes from",
      "Voir d'où vient un réglage",
      "git config --list --show-origin",
      "Lists every setting with the file that sets it.",
      "Liste chaque réglage avec le fichier qui le définit.",
    ],
  ],
  commit: [
    [
      "See what changed",
      "Voir ce qui a changé",
      "git status -sb",
      "Short status with the branch and how far it is from its upstream.",
      "État court avec la branche et son écart avec l'amont.",
    ],
    [
      "Stage part of a file",
      "Indexer une partie d'un fichier",
      "git add -p <file>",
      "Asks hunk by hunk what to stage.",
      "Demande morceau par morceau quoi indexer.",
    ],
    [
      "Stage everything, including deletions",
      "Tout indexer, suppressions comprises",
      "git add -A",
      "New, modified and deleted files in the whole repository.",
      "Fichiers nouveaux, modifiés et supprimés dans tout le dépôt.",
    ],
    [
      "Commit with a message",
      "Commiter avec un message",
      'git commit -m "feat: add login"',
      "Add -a to also stage changes to tracked files.",
      "Ajoute -a pour indexer aussi les fichiers suivis modifiés.",
    ],
    [
      "Fix the last commit message or add a forgotten file",
      "Corriger le dernier message de commit ou ajouter un fichier oublié",
      'git add <file>\ngit commit --amend --no-edit\ngit commit --amend -m "new message"',
      "Rewrites the last commit: avoid it once pushed and shared.",
      "Réécrit le dernier commit : à éviter une fois poussé et partagé.",
      true,
    ],
    [
      "Make an empty commit",
      "Faire un commit vide",
      'git commit --allow-empty -m "chore: trigger CI"',
      "Handy to re-run a pipeline.",
      "Pratique pour relancer une CI.",
    ],
    [
      "Stop tracking a file but keep it on disk",
      "Arrêter de suivre un fichier sans le supprimer",
      "git rm --cached <file>",
      "Then add it to .gitignore.",
      "Ajoute-le ensuite au .gitignore.",
    ],
    [
      "Rename or move a file",
      "Renommer ou déplacer un fichier",
      "git mv <old> <new>",
      "Same as mv plus git add of both paths.",
      "Équivaut à mv plus git add des deux chemins.",
    ],
  ],
  inspect: [
    [
      "See the history as a graph",
      "Voir l'historique en graphe",
      "git log --oneline --graph --decorate --all",
      "One line per commit, all branches.",
      "Une ligne par commit, toutes les branches.",
    ],
    [
      "See the changes not yet staged / staged",
      "Voir les modifications non indexées / indexées",
      "git diff\ngit diff --staged",
      "--staged shows what the next commit will contain.",
      "--staged montre ce que contiendra le prochain commit.",
    ],
    [
      "Compare two branches",
      "Comparer deux branches",
      "git diff main...feature\ngit log main..feature",
      "Three dots: changes since they diverged. Two dots in log: commits only in feature.",
      "Trois points : changements depuis la divergence. Deux points dans log : commits seulement dans feature.",
    ],
    [
      "Find who changed a line",
      "Trouver qui a modifié une ligne",
      "git blame -L 10,20 <file>",
      "Add -w to ignore whitespace changes.",
      "Ajoute -w pour ignorer les changements d'espaces.",
    ],
    [
      "Find the commits that added or removed a text",
      "Trouver les commits qui ont ajouté ou retiré un texte",
      'git log -S "functionName" --oneline',
      "The “pickaxe”: searches the content of the changes.",
      "La « pioche » : cherche dans le contenu des changements.",
    ],
    [
      "Search commit messages",
      "Chercher dans les messages de commit",
      'git log --grep "fix" -i --oneline',
      "-i ignores case.",
      "-i ignore la casse.",
    ],
    [
      "See the history of one file, renames included",
      "Voir l'historique d'un fichier, renommages compris",
      "git log --follow -p -- <file>",
      "-p shows each change.",
      "-p montre chaque changement.",
    ],
    [
      "Show a commit or a file at a commit",
      "Afficher un commit ou un fichier à un commit",
      "git show <commit>\ngit show <commit>:<path>",
      "The second form prints the file as it was.",
      "La seconde forme affiche le fichier tel qu'il était.",
    ],
    [
      "Search the tracked files",
      "Chercher dans les fichiers suivis",
      'git grep -n "TODO"',
      "Faster than grep and skips ignored files.",
      "Plus rapide que grep et ignore les fichiers ignorés.",
    ],
    [
      "Count commits per author",
      "Compter les commits par auteur",
      "git shortlog -sn",
      "Add --all for every branch.",
      "Ajoute --all pour toutes les branches.",
    ],
  ],
  branches: [
    [
      "Create a branch and switch to it",
      "Créer une branche et y basculer",
      "git switch -c <branch>",
      "Older equivalent: git checkout -b <branch>.",
      "Équivalent ancien : git checkout -b <branche>.",
    ],
    [
      "Switch to a branch",
      "Changer de branche",
      "git switch <branch>\ngit switch -",
      "git switch - goes back to the previous branch.",
      "git switch - revient à la branche précédente.",
    ],
    [
      "List branches",
      "Lister les branches",
      "git branch -vv\ngit branch -a",
      "-vv shows upstreams, -a includes remote branches.",
      "-vv montre l'amont, -a inclut les branches distantes.",
    ],
    [
      "Rename a branch",
      "Renommer une branche",
      "git branch -m <old> <new>",
      "Without <old>, renames the current branch.",
      "Sans <ancienne>, renomme la branche courante.",
    ],
    [
      "Delete a merged branch",
      "Supprimer une branche fusionnée",
      "git branch -d <branch>",
      "Refuses if the branch is not merged.",
      "Refuse si la branche n'est pas fusionnée.",
    ],
    [
      "Force-delete a branch",
      "Supprimer une branche de force",
      "git branch -D <branch>",
      "Unmerged commits are only reachable through the reflog afterwards.",
      "Les commits non fusionnés ne sont plus accessibles que par le reflog.",
      true,
    ],
    [
      "Merge a branch into the current one",
      "Fusionner une branche dans la courante",
      "git merge <branch>\ngit merge --no-ff <branch>",
      "--no-ff always creates a merge commit.",
      "--no-ff crée toujours un commit de fusion.",
    ],
    [
      "Squash a branch into one commit",
      "Fusionner une branche en un seul commit",
      "git merge --squash <branch>\ngit commit",
      "Stages all the branch's changes for one commit.",
      "Indexe tous les changements de la branche pour un seul commit.",
    ],
    [
      "Abort a merge with conflicts",
      "Abandonner une fusion en conflit",
      "git merge --abort",
      "Back to the state before the merge.",
      "Retour à l'état d'avant la fusion.",
    ],
    [
      "Take one commit from another branch",
      "Récupérer un commit d'une autre branche",
      "git cherry-pick <commit>",
      "Add -x to note the original commit in the message.",
      "Ajoute -x pour noter le commit d'origine dans le message.",
    ],
    [
      "Pick a side in a conflict",
      "Choisir un côté dans un conflit",
      "git checkout --ours <file>\ngit checkout --theirs <file>",
      "During a rebase, ours and theirs are swapped.",
      "Pendant un rebase, ours et theirs sont inversés.",
    ],
  ],
  undo: [
    [
      "Discard changes to a file",
      "Annuler les modifications d'un fichier",
      "git restore <file>",
      "Uncommitted changes in that file are lost.",
      "Les modifications non commitées du fichier sont perdues.",
      true,
    ],
    [
      "Unstage a file",
      "Retirer un fichier de l'index",
      "git restore --staged <file>",
      "The changes stay in the working tree.",
      "Les modifications restent dans l'arbre de travail.",
    ],
    [
      "Undo the last commit, keep the changes",
      "Annuler le dernier commit en gardant les changements",
      "git reset --soft HEAD~1",
      "The changes stay staged. Use --mixed (the default) to unstage them too.",
      "Les changements restent indexés. --mixed (par défaut) les désindexe aussi.",
    ],
    [
      "Throw away the last commit and its changes",
      "Jeter le dernier commit et ses changements",
      "git reset --hard HEAD~1",
      "Uncommitted work is lost for good; the commit stays in the reflog for a while.",
      "Le travail non commité est perdu ; le commit reste un temps dans le reflog.",
      true,
    ],
    [
      "Undo a pushed commit safely",
      "Annuler un commit déjà poussé sans risque",
      "git revert <commit>",
      "Adds a new commit that reverses it: history is not rewritten.",
      "Ajoute un commit inverse : l'historique n'est pas réécrit.",
    ],
    [
      "Make the branch match the remote exactly",
      "Aligner la branche exactement sur le distant",
      "git fetch origin\ngit reset --hard origin/<branch>",
      "Local commits and changes on this branch are lost.",
      "Les commits et changements locaux de la branche sont perdus.",
      true,
    ],
    [
      "Recover a lost commit or branch",
      "Récupérer un commit ou une branche perdus",
      "git reflog\ngit switch -c rescue <commit>",
      "The reflog lists every position HEAD has had (kept ~90 days).",
      "Le reflog liste toutes les positions de HEAD (gardées ~90 jours).",
    ],
    [
      "Restore a file from another commit",
      "Restaurer un fichier depuis un autre commit",
      "git restore --source <commit> <file>",
      "Overwrites the file in the working tree.",
      "Écrase le fichier dans l'arbre de travail.",
      true,
    ],
    [
      "Remove a file from all history",
      "Supprimer un fichier de tout l'historique",
      "git filter-repo --invert-paths --path <file>",
      "Needs git-filter-repo. Rewrites every commit: everyone must re-clone. Rotate any leaked secret.",
      "Nécessite git-filter-repo. Réécrit tous les commits : tout le monde doit recloner. Change tout secret divulgué.",
      true,
    ],
  ],
  stash: [
    [
      "Put changes aside",
      "Mettre des changements de côté",
      'git stash push -m "wip"\ngit stash push -u',
      "-u also stashes untracked files.",
      "-u met aussi de côté les fichiers non suivis.",
    ],
    [
      "List and look at stashes",
      "Lister et voir les remises",
      "git stash list\ngit stash show -p stash@{0}",
      "-p shows the full diff.",
      "-p montre le diff complet.",
    ],
    [
      "Get stashed changes back",
      "Récupérer des changements mis de côté",
      "git stash pop\ngit stash apply stash@{1}",
      "pop removes the stash after applying it, apply keeps it.",
      "pop supprime la remise après application, apply la garde.",
    ],
    [
      "Stash only some files",
      "Mettre de côté seulement certains fichiers",
      "git stash push -- <path>…",
      "Or -p to choose hunks.",
      "Ou -p pour choisir les morceaux.",
    ],
    [
      "Turn a stash into a branch",
      "Transformer une remise en branche",
      "git stash branch <branch> stash@{0}",
      "Useful when the stash no longer applies cleanly.",
      "Utile quand la remise ne s'applique plus proprement.",
    ],
    [
      "Delete stashes",
      "Supprimer des remises",
      "git stash drop stash@{0}\ngit stash clear",
      "clear deletes all of them.",
      "clear les supprime toutes.",
      true,
    ],
  ],
  rebase: [
    [
      "Update a branch on top of main",
      "Mettre une branche à jour par-dessus main",
      "git fetch origin\ngit rebase origin/main",
      "Replays your commits on the latest main. Rewrites the branch's commits.",
      "Rejoue tes commits sur le dernier main. Réécrit les commits de la branche.",
    ],
    [
      "Clean up the last commits (squash, reword, reorder)",
      "Nettoyer les derniers commits (fusionner, renommer, réordonner)",
      "git rebase -i HEAD~5",
      "Change pick to squash, fixup, reword, drop… in the editor.",
      "Remplace pick par squash, fixup, reword, drop… dans l'éditeur.",
    ],
    [
      "Make a fixup commit and fold it in",
      "Créer un commit de correction et l'intégrer",
      "git commit --fixup <commit>\ngit rebase -i --autosquash <commit>~1",
      "The fixup is moved and squashed automatically.",
      "La correction est déplacée et fusionnée automatiquement.",
    ],
    [
      "Continue, skip or abort a rebase",
      "Continuer, sauter ou abandonner un rebase",
      "git rebase --continue\ngit rebase --skip\ngit rebase --abort",
      "Resolve conflicts and git add before --continue.",
      "Résous les conflits et fais git add avant --continue.",
    ],
    [
      "Pull with rebase instead of merge",
      "Faire un pull en rebase plutôt qu'en fusion",
      "git pull --rebase\ngit config --global pull.rebase true",
      "Keeps a linear history.",
      "Garde un historique linéaire.",
    ],
    [
      "Remember conflict resolutions",
      "Mémoriser les résolutions de conflits",
      "git config --global rerere.enabled true",
      "Git reapplies a resolution it has already seen.",
      "Git réapplique une résolution déjà vue.",
    ],
    [
      "Move a branch onto another base",
      "Déplacer une branche sur une autre base",
      "git rebase --onto <new-base> <old-base> <branch>",
      "Takes the commits after old-base and replays them on new-base.",
      "Prend les commits après l'ancienne base et les rejoue sur la nouvelle.",
    ],
  ],
  remote: [
    [
      "List and add remotes",
      "Lister et ajouter des dépôts distants",
      "git remote -v\ngit remote add upstream <url>",
      "upstream is the usual name for the original repo of a fork.",
      "upstream est le nom habituel du dépôt d'origine d'un fork.",
    ],
    [
      "Change a remote's URL",
      "Changer l'URL d'un dépôt distant",
      "git remote set-url origin <url>",
      "For example to move from HTTPS to SSH.",
      "Par exemple pour passer de HTTPS à SSH.",
    ],
    [
      "Fetch without merging",
      "Récupérer sans fusionner",
      "git fetch --all --prune",
      "--prune drops remote branches deleted on the server.",
      "--prune retire les branches distantes supprimées sur le serveur.",
    ],
    [
      "Push a new branch and track it",
      "Pousser une nouvelle branche et la suivre",
      "git push -u origin <branch>",
      "Afterwards, plain git push and git pull work.",
      "Ensuite, git push et git pull suffisent.",
    ],
    [
      "Force-push safely",
      "Forcer un push sans risque",
      "git push --force-with-lease",
      "Refuses if someone else pushed in the meantime. Plain --force overwrites their work.",
      "Refuse si quelqu'un a poussé entre-temps. --force tout court écrase son travail.",
      true,
    ],
    [
      "Delete a remote branch",
      "Supprimer une branche distante",
      "git push origin --delete <branch>",
      "Others keep their copy until they prune.",
      "Les autres gardent leur copie jusqu'à un prune.",
      true,
    ],
    [
      "Check out a pull request locally (GitHub)",
      "Récupérer une pull request en local (GitHub)",
      "git fetch origin pull/<id>/head:pr-<id>\ngit switch pr-<id>",
      "GitLab uses merge-requests/<id>/head.",
      "GitLab utilise merge-requests/<id>/head.",
    ],
    [
      "Sync a fork with its upstream",
      "Synchroniser un fork avec son dépôt d'origine",
      "git fetch upstream\ngit switch main\ngit merge --ff-only upstream/main\ngit push",
      "--ff-only refuses if your main has diverged.",
      "--ff-only refuse si ton main a divergé.",
    ],
  ],
  tags: [
    [
      "Create an annotated tag",
      "Créer un tag annoté",
      'git tag -a v1.2.0 -m "Release 1.2.0"',
      "Annotated tags store author, date and message; add -s to sign.",
      "Les tags annotés gardent auteur, date et message ; ajoute -s pour signer.",
    ],
    [
      "List tags",
      "Lister les tags",
      'git tag -l "v1.*" --sort=-v:refname',
      "Newest version first.",
      "Version la plus récente en premier.",
    ],
    [
      "Push tags",
      "Pousser des tags",
      "git push origin v1.2.0\ngit push --tags",
      "Tags are not pushed by plain git push.",
      "git push seul ne pousse pas les tags.",
    ],
    [
      "Delete a tag locally and remotely",
      "Supprimer un tag en local et à distance",
      "git tag -d v1.2.0\ngit push origin --delete v1.2.0",
      "Anyone who fetched it keeps it.",
      "Ceux qui l'ont récupéré le gardent.",
      true,
    ],
    [
      "Find the latest tag",
      "Trouver le dernier tag",
      "git describe --tags --abbrev=0",
      "Without --abbrev=0: tag, commits since, and hash.",
      "Sans --abbrev=0 : tag, nombre de commits depuis et hash.",
    ],
  ],
  worktrees: [
    [
      "Work on another branch in a second folder",
      "Travailler sur une autre branche dans un second dossier",
      "git worktree add ../hotfix <branch>\ngit worktree add -b <new-branch> ../feature",
      "Each worktree has its own checkout, sharing one repository.",
      "Chaque worktree a sa propre copie de travail, avec un seul dépôt partagé.",
    ],
    [
      "List worktrees",
      "Lister les worktrees",
      "git worktree list",
      "Shows the folder, commit and branch of each.",
      "Montre le dossier, le commit et la branche de chacun.",
    ],
    [
      "Remove a worktree",
      "Supprimer un worktree",
      "git worktree remove ../hotfix\ngit worktree prune",
      "--force removes it even with uncommitted changes (they are lost).",
      "--force le supprime même avec des changements non commités (perdus).",
    ],
  ],
  bisect: [
    [
      "Find the commit that introduced a bug",
      "Trouver le commit qui a introduit un bug",
      "git bisect start\ngit bisect bad\ngit bisect good <commit>",
      "Git checks out the middle commit; answer good or bad until it names the culprit.",
      "Git se place au milieu ; réponds good ou bad jusqu'à ce qu'il désigne le coupable.",
    ],
    [
      "Mark a commit during a bisect",
      "Marquer un commit pendant un bisect",
      "git bisect good\ngit bisect bad\ngit bisect skip",
      "skip when the commit cannot be tested.",
      "skip quand le commit ne peut pas être testé.",
    ],
    [
      "Automate a bisect with a test script",
      "Automatiser un bisect avec un script de test",
      "git bisect run npm test",
      "Exit code 0 = good, 1–127 = bad, 125 = skip.",
      "Code de sortie 0 = good, 1–127 = bad, 125 = skip.",
    ],
    [
      "End a bisect",
      "Terminer un bisect",
      "git bisect reset",
      "Back to where you started.",
      "Retour au point de départ.",
    ],
  ],
  cleanup: [
    [
      "Preview untracked files to delete",
      "Prévisualiser les fichiers non suivis à supprimer",
      "git clean -n -d",
      "Dry run: lists what git clean -f would remove.",
      "Simulation : liste ce que git clean -f supprimerait.",
    ],
    [
      "Delete untracked files and folders",
      "Supprimer les fichiers et dossiers non suivis",
      "git clean -fd\ngit clean -fdx",
      "-x also deletes ignored files (build output, .env…). Cannot be undone.",
      "-x supprime aussi les fichiers ignorés (builds, .env…). Irréversible.",
      true,
    ],
    [
      "Delete local branches already merged",
      "Supprimer les branches locales déjà fusionnées",
      "git branch --merged main | grep -v ' main$' | xargs git branch -d",
      "Check the list first with git branch --merged main.",
      "Vérifie d'abord la liste avec git branch --merged main.",
    ],
    [
      "Drop references to deleted remote branches",
      "Retirer les références aux branches distantes supprimées",
      "git remote prune origin\ngit config --global fetch.prune true",
      "The setting prunes on every fetch.",
      "Le réglage nettoie à chaque fetch.",
    ],
    [
      "Compact the repository",
      "Compacter le dépôt",
      "git gc\ngit maintenance start",
      "maintenance schedules background optimisation.",
      "maintenance planifie une optimisation en arrière-plan.",
    ],
    [
      "Check the repository for corruption",
      "Vérifier l'intégrité du dépôt",
      "git fsck --full",
      "Also lists dangling commits you may want to recover.",
      "Liste aussi les commits orphelins que tu voudrais récupérer.",
    ],
  ],
};

export const TIPS: GitTip[] = (Object.keys(G) as GroupId[]).flatMap((group) =>
  G[group].map(([en, fr, cmd, noteEn, noteFr, danger]) => ({
    group,
    en,
    fr,
    cmd,
    noteEn,
    noteFr,
    ...(danger ? { danger: true } : {}),
  })),
);
