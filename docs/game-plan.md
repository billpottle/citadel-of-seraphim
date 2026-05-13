# Citadel of the Seraphim Game Plan

## Direction

Citadel of the Seraphim is a browser-first tactical lane defense game. Towers and gates are fixed. Angel units hold positions until the player selects a new destination, then redeploy at their unit movement speed.

## Prototype Scope

- One battlefield with one main path.
- Purchasable towers placed only on fixed pedestal slots.
- One gate with HP.
- Movable angel host squads using individual member HP/MP.
- Three timed enemy waves.
- Click-to-select and click-to-move unit control, snapped to valid path positions.
- Energy economy for towers, host deployment, and expensive purification.
- Defeat happens only when demons breach the gate; host wipes do not end the battle.

## Near-Term Systems

- Add named angels and archangel reward units.
- Add gate variants with defensive effects.
- Add level-based tower and host unlocks.
- Add more MP-spending abilities and player-triggered hero powers.
- Add wave rewards that unlock named angels and permanent upgrades.

## Character Animation Pipeline

The current art is portrait/token art for proving gameplay. Production units should use transparent sprite sheets or packed atlases with a consistent animation vocabulary:

- `idle`
- `walk`
- `attack`
- `cast`
- `hit`
- `die`

The code already has an animation catalog shape in `src/game/animationCatalog.ts`. Static placeholder art uses one-frame animations so we can replace the texture paths and frame metadata later without changing unit or enemy combat logic.

## Asset Policy

Character art from the sibling `angel-wars` repo should be copied into this repo before use. Runtime paths should never point outside this project.

Current copied source assets:

- `angel-wars/encyclopedia/assets/characters/alizel.webp`
- `angel-wars/encyclopedia/assets/characters/michael.webp`
- `angel-wars/encyclopedia/assets/characters/gabriel.webp`
- `angel-wars/encyclopedia/assets/characters/corrupted-v2/eligos-fallen.webp`

Generated concept assets:

- `public/assets/concepts/citadel-battlefield-concept.png`
- `public/assets/concepts/angel-defender-animation-reference.png`
- `public/assets/concepts/tower-types-reference.png`
- `public/assets/concepts/enemy-types-reference.png`
- `public/assets/sprites/angel-defender/idle.png`
- `public/assets/sprites/angel-defender/walk.png`
- `public/assets/sprites/angel-defender/attack.png`
- `public/assets/sprites/angel-defender/cast.png`
- `public/assets/sprites/angel-defender/hit.png`
- `public/assets/sprites/angel-defender/die.png`
- `public/assets/sprites/towers/*.png`
- `public/assets/sprites/enemies/*.png`

The battlefield concept is now used as the active map background. The angel defender reference sheet has been converted into temporary transparent prototype frames and wired into the unit animation catalog.

## Current Economy Prototype

- Energy starts at `120`.
- Angel Host costs `75` energy.
- Healer Choir costs `95` energy.
- Thrones cost `130` energy.
- Archers cost `105` energy.
- Cavalry costs `120` energy.
- Purify Corruption costs `260` energy.
- Defeated enemies grant energy based on enemy type.
- The host flow is: choose Hosts, choose a host type, then click a valid path point.
- The tower flow is: choose Towers, choose a tower type, then click an empty pedestal.
- `S`, `T`, and `P` switch to Hosts, Towers, and Purify for quick local testing.

## Current Host Types

- Angel Host: balanced squad with steady ranged fire.
- Healer Choir: no damage, spends MP to heal nearby allied hosts.
- Thrones: slow armored blockers with high HP and strong damage reduction.
- Archers: fragile long-range pressure squad.
- Cavalry: fast redeploying short-range burst squad.

## Current Tower Types

- Lightspire: fast, low-damage projectile fire.
- Judgment Lens: slow, high-damage projectile fire.
- Harmonic Bell: periodic shockwave damage around the tower.
- Sanctuary Well: restores HP/MP to nearby angel hosts.
- Flame Choir: stronger, slower shockwave damage.
- Prism Chain: medium-speed projectile tower with longer range.
- Temporal Font: time-field tower that slows enemy movement and corrupted-host attack tempo.

## Current Enemy Types

- Corrupted Scout: fast, light enemy.
- Fallen Swordsman: baseline dark angel.
- Siege Brute: slow, durable gate breaker.
- Shadow Caster: medium enemy with corruption projectiles.
- Flying Harrier: fast flyer-style enemy.
- Dark Archangel: boss-class enemy with stronger corruption projectiles.

## Current Corruption Prototype

- Demon projectiles damage angel hosts and add corruption.
- Fully corrupted angel hosts remain on the field, switch to the demon team, turn around visually, and attack angel units.
- Purify Corruption spends high energy to flip corrupted hosts back to the angel team.
- Purifying path enemies still captures them as angel-side host squads.

## Current Audio Prototype

- Music and sound effects are generated with the browser Web Audio API.
- Music starts after a player interaction or from the Audio button.
- Current sound cues cover tower building, host deployment, holy projectiles, demon projectiles, shockwaves, enemy rewards, purification, corruption, victory, and defeat.
- Later production audio can replace `src/game/AudioDirector.ts` with loaded music and effect files without changing combat logic.
