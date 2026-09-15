---
objective: "Le plugin Notebook (fork de Handbook) build, lint et passe ses tests sans code TTRPG, entièrement renommé Brumes→Notebook/Game→Pack, avec deux packs de style natifs (gestion-projet, client-guide) fonctionnels dès l'installation."
status: in-progress
---

# Plan: Fork Notebook (depuis Handbook)

## Overview

| Field      | Value                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| **Goal**   | Terminer le fork : purger le contenu TTRPG résiduel, renommer Brumes/Game→Notebook/Pack, livrer 2 packs natifs |
| **Source** | Brainstorm approuvé (session) + exploration du code sous `C:\Users\fxgui\Documents\Code\Perso\notebook` |

## Phases

| #   | Phase                                            | File                          |
| --- | ------------------------------------------------- | ----------------------------- |
| 1   | Purge TTRPG résiduelle + réparation des imports    | [`phase-1.md`](./phase-1.md)  |
| 2   | Renommage Brumes→Notebook / Game→Pack              | [`phase-2.md`](./phase-2.md)  |
| 3   | Packs natifs gestion-projet et client-guide        | [`phase-3.md`](./phase-3.md)  |
| 4   | Vérification finale                                | [`phase-4.md`](./phase-4.md)  |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| `gestion-projet` et `client-guide` sont déclarés en dur dans `DECLARED_PACKS` (code source), et non livrés comme packs installables côté vault (`packs/<id>/pack.json`) ou starter-kit. | Handbook garde `DECLARED_GAMES` vide par principe : « Handbook owns renderers, never game design: packs are installed data » — une règle motivée par le fait qu'un jeu est une IP tierce (City of Mist, Legend in the Mist…) que le moteur ne doit pas embarquer. Ce raisonnement ne s'applique pas à Notebook : `gestion-projet`/`client-guide` sont du contenu Notebook de première main, et le vault doit disposer de ses outils habituels dès l'installation, sans étape de seed manuelle. Le mécanisme `packs/<id>/pack.json` reste disponible tel quel pour un pack tiers futur. |
| Version repart à `0.1.0` (au lieu de continuer `2.8.6`). | Notebook n'a aucun utilisateur existant ; `2.8.6` est l'historique de Handbook et n'a aucun sens pour un premier fork non publié. |
