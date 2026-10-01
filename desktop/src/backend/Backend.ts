import type { FileDropEvent, SkillFileResult, SkillToggleResult } from './types';
import type { AppUpdateStaged, AppUpdateStatus, LaunchContext, IdentityArgs, IdentityWrite, Settings, Onboarding, Features, Capabilities, Surfaces, ReadOptions, Catalog, ChangeSource, DeriveBriefArgs, DerivedBrief, EvalArgs, EvalManyArgs, EvalManyResult, EvalResult, UsageModel, MissesModel, EvalReportModel, InboxItem, InstallArgs, InstalledResult, InviteArgs, InviteResult, MachineUninstallResult, PrefStore, PublishArgs, PublishResult, UnpublishArgs, UnpublishResult, Receipt, ReconcileResult, Result, Roster, Run, LibraryScope, ProjectAdded, ProjectRemoved, ProjectRenamed, ProjectCreated, SearchArgs, SearchHit, SetupArgs, SetupResult, Library, SkillDetail, StatusResult, Subscription, SyncArgs, SyncResult, TeamArgs, TeamResult, UninstallArgs, UninstalledResult, UpdateAdvice, ValidateArgs, ValidateResult } from './types';
export interface Backend {
  setWindowBackground(color: string): Promise<Result<void>>;
  quit(): Promise<void>;
  features(): Promise<Features>;
  windowAction(action: 'toggle-maximize' | 'start-drag'): Promise<Result<void>>;
  openUrl(url: string): Promise<Result<void>>;
  revealPath(path: string): Promise<Result<void>>;
  /** Native folder chooser. `null` is a cancelled dialog, not a failure. */
  pickFolder(): Promise<Result<string | null>>;
  capabilities(): Promise<Capabilities>;
  surfaces(): Promise<Surfaces>;
  launchContext(): Promise<LaunchContext | null>;
  refreshLaunch(): Promise<LaunchContext | null>;
  onLaunchRequest(listener: () => void): Subscription;
  /** Folders dragged from the OS onto the window. The Tauri shell forwards the webview's drag-drop events; the browser mock
   *  reads `text/plain` lines from an HTML5 drop (a browser never exposes a dropped folder's path). */
  onFileDrop(listener: (event: FileDropEvent) => void): Subscription;
  status(q?: undefined, options?: ReadOptions): Promise<Result<StatusResult>>;
  settings(q?: undefined, options?: ReadOptions): Promise<Result<Settings>>;
  onboarding(q?: undefined, options?: ReadOptions): Promise<Result<Onboarding>>;
  skillFile: {move(args:{path:string;to:string}):Run<SkillFileResult>;copy(args:{path:string;to:string}):Run<SkillFileResult>;rename(args:{path:string;to:string}):Run<SkillFileResult>;delete(args:{path:string}):Run<SkillFileResult>;fix(args:{path:string}):Run<SkillFileResult>;
   /** `skill category <path> --to <name>`: rewrites `metadata.terum-category` in that folder's SKILL.md and stops.
    *  It never publishes — a published category lives inside an immutable version — so the team keeps showing what its
    *  newest version declares until the user publishes again. The notices carry that sentence and the command. */
   category(args:{path:string;to:string}):Run<SkillFileResult>};
  /** The per-machine switch behind `capabilities().disablePerMachine`: `skill enable|disable <path>` writes Claude Code's own
   *  `skillOverrides` for the folder's root — the same key the `/skills` menu writes — and the next Library read shows the result. */
  setSkillEnabled(args: { path: string; enabled: boolean }): Run<SkillToggleResult>;
  library(q: { scope: LibraryScope; team?: string }, options?: ReadOptions): Promise<Result<Library>>;
  localSkill(q: { path: string }, options?: ReadOptions): Promise<Result<SkillDetail>>;
  /** §7.1 L-PROJ: the folders this machine reads local skills from. Nothing else adds one. */
  projects: { add(path:string):Run<ProjectAdded>; remove(path:string):Run<ProjectRemoved>;
    /** `project rename <path> --to <name>`: a display name for one row; the folder is unchanged. Offered only where `features.projectRename` is true. */
    rename(args:{path:string;name:string}):Run<ProjectRenamed> };
  reconcile: { list():Promise<Result<ReconcileResult>> };
  /** Team projects (team.json), not the local folders above: `create` names one and commits it to the team's main. */
  teamProjects: { create(args:{name:string;remote?:string}):Run<ProjectCreated> };
  /** `at` restricts the answer to one Library root: presence, path, scope and version describe the
   *  copy in that root, while the install destinations still list every root on the machine.
   *  Omitted keeps the machine-wide answer a deep link, a bookmark or the marketplace needs. */
  skill(q: { ref: string; team?: string; at?: LibraryScope }, options?: ReadOptions): Promise<Result<SkillDetail>>;
  evalReport(q: { ref: string; team?: string }, options?: ReadOptions): Promise<Result<EvalReportModel>>;
  /** Live firing counts for one skill. Read-only over the team repo; the CLI's own archive append is
   *  machine-local (see SERVE_READ_VERBS). Gated on `features.usage`. */
  usage(q: { ref: string }, options?: ReadOptions): Promise<Result<UsageModel>>;
  /** Screen real prompts for skills that looked applicable and never fired. Gated on `features.misses`.
   *
   *  Returns a `Run`, not a `Promise<Result>`, and the difference is the point: this SPENDS MODEL
   *  CALLS (about one per ten prompts screened), so it is an ACTION like `eval`, never a read like
   *  `usage`. It must only ever be started from an explicit user action -- never from a query that
   *  fires on mount, and never from a loader. `Run` carries `cancel()` for the same reason.
   *
   *  It is deliberately NOT in SERVE_READ_VERBS: that list is reads-only because a long-lived
   *  process must not own agent children, which is exactly why `eval` is excluded from it too. Each
   *  call is a fresh one-shot CLI process. */
  misses(q?: { since?: string; limit?: number }): Run<MissesModel>;
  receipts(q: { skillId: string; version: string }, options?: ReadOptions): Promise<Result<Receipt | null>>;
  inbox(q?: undefined, options?: ReadOptions): Promise<Result<InboxItem[]>>;
  catalog(q?: { q?: string }, options?: ReadOptions): Promise<Result<Catalog>>;
  roster(q?: undefined, options?: ReadOptions): Promise<Result<Roster>>;
  search(args: SearchArgs, options?: ReadOptions): Promise<Result<SearchHit[]>>;
  profile(args: { name?: string; bio?: string; role?: string; projects?: string[] }): Run<{ handle: string; changed: string[] }>;
  setIdentity(args: IdentityArgs): Run<IdentityWrite>;
  install(args: InstallArgs): Run<InstalledResult[]>;
  uninstallSkill(args: UninstallArgs): Run<UninstalledResult[]>;
  uninstallMachine(args: Record<string, never>): Run<MachineUninstallResult>;
  publish(args: PublishArgs): Run<PublishResult>;
  /** Publish a whole selection in one CLI run: one push for all of them, and one answer per question. */
  publishMany(args: PublishManyArgs): Run<PublishResult[]>;
  /** Retract a skill from the team marketplace. Destructive and team-wide: confirm before calling. */
  unpublish(args: UnpublishArgs): Run<UnpublishResult>;
  sync(args: SyncArgs): Run<SyncResult>;
  prune(): Run<void>;
  invite(args: InviteArgs): Run<InviteResult>;
  team(args: TeamArgs): Run<TeamResult>;
  setup(args: SetupArgs): Run<SetupResult>;
  eval(args: EvalArgs): Run<EvalResult>;
  /**
   * IE6 §3.1: derive the shared head-to-head brief and stop. The brief is the whole neutrality
   * guarantee and a human signs it; a spawned CLI cannot ask, so the app asks instead — derive
   * here, show the text for review, then call `eval` with the reviewed file as `brief`.
   * Optional: an older CLI on this machine has no `--derive-brief`, and the caller hides the
   * feature rather than failing at spawn time.
   */
  deriveBrief?(args: DeriveBriefArgs): Run<DerivedBrief>;
  /** Several skills at once, or every pending one: run now, in batches with a question between them, or queued for a window. */
  evalMany(args: EvalManyArgs): Run<EvalManyResult>;
  validate(args: ValidateArgs, options?: ReadOptions): Promise<Result<ValidateResult>>;
  update(q?: undefined, options?: ReadOptions): Promise<Result<UpdateAdvice>>;
  /** The desktop app's own update channel. Rendered only where `surfaces().appUpdate` is true. */
  appUpdate: {
    check(q?: { force?: boolean }, options?: ReadOptions): Promise<Result<AppUpdateStatus>>;
    stage(version: string): Run<AppUpdateStaged>;
    apply(version: string, reason?: 'manual' | 'overnight'): Promise<Result<void>>;
    armOnClose(version: string): Promise<Result<void>>;
    disarmOnClose(): Promise<Result<void>>;
  };
  diagnostics(): Run<void>;
  openInEditor(path: string): Promise<Result<void>>;
  copyToClipboard(text: string): Promise<Result<void>>;
  copyImage(png: Blob): Promise<Result<void>>;
  canShareImage(png:Blob):boolean;
  shareImage(png:Blob,name:string):Promise<Result<void>>;
  saveImage(png:Blob,name:string):Promise<Result<void>>;
  readonly prefs: PrefStore;
  subscribe(listener: (source: ChangeSource) => void): Subscription;
}
