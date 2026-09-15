# Les corpus de contrat

Handbook exerce chaque format depuis le corpus du dépôt qui possède son
contrat. Il ne recopie plus les documents Mist : le package immuable
`schema-in-the-mist` v1.0.0 est leur source unique.

| Famille | Source des cas | Attentes |
| --- | --- | --- |
| Mist Engine | `schema-in-the-mist/corpus/contract/cases.json` installé | `canonical` pour le codec strict, `handbook` pour la projection tolérante |
| Adrenaline | `schema-adrenaline/corpus/cases.json` installé | `accept|reject` strict, puis projection Handbook tolérante |
| PbtA | `schema-pbta/corpus/contract/cases.json` installé | codec strict, puis cas TOML acceptés des capacités `move` et `playbook` |

`pnpm assert:corpus` combine les deux sources et exige qu’un bloc enregistré
ait un document qu’il sait lire ainsi qu’une commande de copie TOML. Il échoue
si un fichier local reprend l’id d’un format Mist, Adrenaline ou PbtA, afin que les corpus ne
puissent plus dériver.

## Corpus Mist installé

Le manifeste partagé couvre les 14 cibles publiques du contrat Mist Engine.
Handbook en rend 12 ; `city-of-mist/custom-move` et
`city-of-mist/theme-kit` restent volontairement sans renderer.

Chaque entrée porte deux verdicts indépendants :

- `canonical: accept|reject` contrôle le codec publié ;
- `handbook: render|degraded|null` contrôle le consommateur.

`render` exige une projection complète. `degraded` garantit qu’un document
refusé par le codec ne fait pas jeter Handbook : selon la grammaire concernée,
il produit une projection partielle ou le fallback contrôlé du bloc invalide.
`null` désigne une cible que Handbook ne rend pas.

Un nouveau cas Mist se corrige et se publie dans `schema-in-the-mist`, jamais
dans ce dossier. `pnpm assert:mist-contract` vérifie le manifeste entier, les
aller-retours sémantiques des codecs et les sorties des 12 exporters Handbook.

## Corpus local

Les dossiers `temoins/` et `refus/` restent la source des contrats possédés par
Handbook ou par une intégration qui ne publie pas encore ce type de manifeste.

Un témoin est un document complet qui doit se parser et rendre du texte. Un
refus porte une faute réelle et commence par l’une des directives suivantes :

```toml
# attend: null
```

```toml
# attend: dégradé
```

`null` signifie que la faute empêche la projection. `dégradé` signifie que le
champ fautif se perd mais que le reste se rend. Un format local nouveau ajoute
au moins un témoin, ses refus pertinents et une commande de copie TOML.

## Lancer

```bash
pnpm assert:mist-contract
pnpm assert:adrenaline-contract
pnpm assert:corpus
```
