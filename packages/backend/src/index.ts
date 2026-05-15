/**
 * Backend Express per USWC Digital
 * Game engine API
 */

import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createInitialGameState, GameState, serializeGameState } from "@uswc/shared";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json({ limit: "75mb" }));

// ============ IN-MEMORY GAME STATE (MVP) ============

const games = new Map<string, GameState>();

const workspaceRoot = async (): Promise<string> => {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", "..")
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "packages", "shared", "src"));
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return process.cwd();
};

const seedFileForMap = (mapId: string | undefined): string | null => {
  if (mapId === "france") return "france1940Seed.json";
  if (mapId === "balkans") return "balkans1941Seed.json";
  if (mapId === "italy") return "italy1943Seed.json";
  if (mapId === "west") return "fna1942Seed.json";
  if (mapId === "russia") return "barbarossa1941Seed.json";
  return null;
};

// ============ ROUTES ============

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/scenario-file", async (req: Request, res: Response) => {
  const { fileName, contents } = req.body as { fileName?: string; contents?: string };
  if (!contents || typeof contents !== "string") {
    res.status(400).json({ error: "Missing scenario contents" });
    return;
  }

  const safeFileName = (fileName || "uswc-france-1940-current.json").replace(/[^a-zA-Z0-9._-]/g, "_");
  const baseDir = process.env.USWC_DATA_DIR || process.cwd();
  const exportDir = path.resolve(baseDir, "scenario-exports");
  const filePath = path.join(exportDir, safeFileName);
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(filePath, contents, "utf-8");

  res.json({ success: true, filePath });
});

app.post("/api/dev/map-seed", async (req: Request, res: Response) => {
  const { mapId, seed } = req.body as { mapId?: string; seed?: unknown };
  const fileName = seedFileForMap(mapId);
  if (!fileName) {
    res.status(400).json({ error: `Unsupported map seed target: ${mapId || "missing"}` });
    return;
  }
  if (!seed || typeof seed !== "object") {
    res.status(400).json({ error: "Missing seed payload" });
    return;
  }

  const root = await workspaceRoot();
  const targets = [
    path.join(root, "packages", "shared", "src", fileName),
    path.join(root, "packages", "shared", "dist", fileName)
  ];
  const written: string[] = [];
  const backups: string[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const contents = `${JSON.stringify(seed, null, 2)}\n`;

  for (const target of targets) {
    try {
      await fs.access(target);
    } catch {
      continue;
    }
    const backupPath = `${target}.${stamp}.backup`;
    await fs.copyFile(target, backupPath);
    await fs.writeFile(target, contents, "utf-8");
    written.push(target);
    backups.push(backupPath);
  }

  if (written.length === 0) {
    res.status(500).json({ error: "No seed file was written" });
    return;
  }

  res.json({ success: true, fileName, written, backups });
});

// Create new game
app.post("/api/games", (_req: Request, res: Response) => {
  const gameId = `game_${Date.now()}`;
  const newGame: GameState = { ...createInitialGameState(), id: gameId };

  games.set(gameId, newGame);

  res.status(201).json({
    success: true,
    gameId,
    message: "Game created successfully"
  });
});

// Get game state
app.get("/api/games/:gameId", (req: Request, res: Response) => {
  const { gameId } = req.params;
  const game = games.get(gameId);

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(serializeGameState(game));
});

// List all games
app.get("/api/games", (_req: Request, res: Response) => {
  const gamesList = Array.from(games.values()).map((g) => ({
    id: g.id,
    turn: g.turn,
    timestamp: g.timestamp
  }));

  res.json(gamesList);
});

// ============ ERROR HANDLER ============

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`🎮 USWC Backend running on http://localhost:${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api-docs`);
});

export default app;
