/**
 * Validates a player-pool snapshot against the site's data contract before it
 * is committed. Usage: pnpm validate:snapshot [path]
 * (defaults to public/data/available-players.json)
 */
import { readFileSync } from "node:fs";
import { parseSnapshot, SnapshotValidationError } from "../src/lib/pool/validate";

const path = process.argv[2] ?? "public/data/available-players.json";

try {
  const snapshot = parseSnapshot(JSON.parse(readFileSync(path, "utf8")));
  const skaters = snapshot.players.filter((p) => p.type === "skater").length;
  const goalies = snapshot.players.length - skaters;
  const noAdp = snapshot.players.filter((p) => p.adp === null).length;
  const noPortrait = snapshot.players.filter((p) => p.portraitUrl === null).length;
  const noTeam = snapshot.players.filter((p) => p.nhlTeam === null).length;
  console.log(`✓ ${path} is valid`);
  console.log(`  ${snapshot.players.length} players (${skaters} skaters, ${goalies} goalies)`);
  console.log(`  ${noAdp} without ADP · ${noPortrait} without portrait · ${noTeam} without an NHL team`);
} catch (error) {
  if (error instanceof SnapshotValidationError) {
    console.error(error.message);
  } else {
    console.error(`✗ Could not read ${path}: ${(error as Error).message}`);
  }
  process.exit(1);
}
