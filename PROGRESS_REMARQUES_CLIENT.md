# Remarques client — avancement (BUILDMOBILE)

> Fichier de suivi. Si la session s'arrête (limite), reprendre à partir de la première case non cochée.
> Phase 1 : mobile uniquement. **Phase 2 (2026-11-14)** : accord pour ajouter les endpoints manquants dans le full stack (`C:\Users\pc\Documents\GitHub\stock`).

## Remarques du client (résumé)

1. **Transfert de stock** : le dépôt source doit être présélectionné automatiquement = le dépôt qui a le plus de stock (l'utilisateur peut le changer). La liste source ne montre que les dépôts qui ont du stock.
2. **Stock "Sans dépôt"** (ex. Câble Cuivre : 35 rouleaux sans dépôt) : pouvoir le réassocier à un dépôt via le transfert.
3. **Commande — fournisseur** : en choisissant un fournisseur, n'afficher que les matériaux associés à ce fournisseur (comme la version web).
4. **Fournisseur supprimé** (Haji Motawakil) : il apparaît encore comme fournisseur d'un matériau → ne plus l'afficher.
5. **Commande — ligne matériau** : en sélectionnant un matériau, la zone de saisie apparaît directement (pas de bouton "Ajouter" séparé) avec prix unitaire par défaut (modifiable), unité, stock par dépôt, quantité.
6. **Commande — logique stock** : supprimer "Manque pour cette demande / Stock insuffisant" (une commande = approvisionnement, pas lié au stock actuel).
7. **Commande — création** : erreur "endpoint backend indisponible".
8. **Détail commande** : ajouter un bouton **Modifier** (à côté de Supprimer).

## Avancement

- [x] Analyse du code mobile + backend web
- [x] 1. Transfert : source par défaut = plus grand stock, liste source = dépôts avec stock > 0 (`inventory/operation.tsx`)
- [x] 2. "Sans dépôt" : proposé comme source du transfert quand il a du stock ; lignes "Sans dépôt" à 0 masquées dans la fiche matériau
- [x] 3. Commande : matériaux filtrés strictement par fournisseur (`orders/new.tsx`)
- [x] 4. Fournisseur supprimé masqué : hook `src/hooks/useActiveSuppliers.ts` (inventaire, commande), fiche matériau (`supplier.isActive`), `MaterialForm` ne ré-enregistre plus un fournisseur supprimé
- [x] 5/6. Commande : sélection d'un matériau = ligne ajoutée directement (quantité + prix unitaire pré-rempli modifiable, total ligne, stock par dépôt, total commande). Logique "manque / stock insuffisant" supprimée (seul badge info "Sous le seuil minimum")
- [x] 7. Création de commande avec lignes (nouvel endpoint)
- [x] 8. Bouton **Modifier** → `orders/[id]/edit.tsx` : statut, dates + lignes modifiables (quantité, prix, ajouter/retirer). Détail déplacé dans `orders/[id]/index.tsx`, règles d'accès mises à jour (`src/lib/access.ts`, test role-parity)
- [x] Mobile : `npx tsc --noEmit` OK, `npx jest` 105/105
- [x] Backend : aucune erreur TS dans les fichiers modifiés (28 erreurs TS préexistantes ailleurs dans `stock`)
- [ ] **Déployer le backend `stock`** (sinon le mobile reçoit encore l'ancien comportement)
- [ ] Test manuel sur téléphone (création commande, modification lignes, transfert "Sans dépôt")
- [ ] Commit des deux dépôts (rien n'est commité)

## Endpoints ajoutés dans `stock`

- `POST /api/purchase-orders` accepte `items: [{ material_id, quantity, unit_price, notes? }]` → en-tête + lignes dans la même transaction, `totalAmount` calculé côté serveur, numéro `CMD-AAMMJJ-NNN` (retry si doublon), fournisseur actif obligatoire. Sans `items` : en-tête seul comme avant. Rôle : admin.
  - `app/api/purchase-orders/route.ts`, `lib/purchase-orders/items.ts` (validation + helpers)
- `PUT /api/purchase-orders/[id]/items` : remplace toutes les lignes + recalcule le total. Rôles : admin, site_manager.
  - `app/api/purchase-orders/[id]/items/route.ts`
- `POST /api/inventory` avec `{ operation: "transfer", from_unassigned: true, material_id, destination_warehouse_id, quantity }` : déplace le stock "Sans dépôt" (warehouseId null) vers un dépôt ; mouvement `transfer` avec `sourceType: "unassigned"`.
  - `app/api/inventory/route.ts`, `lib/services/inventoryService.ts#assignUnassignedStock`

## Notes techniques

- La table `purchase_orders` n'a **pas** de colonne `notes` : le champ Notes a été retiré de l'écran d'édition mobile (un PATCH avec `notes` planterait côté serveur).
- Écrans mobile : `src/app/(app)/inventory/operation.tsx`, `src/app/(app)/orders/new.tsx`, `src/app/(app)/orders/[id]/index.tsx`, `src/app/(app)/orders/[id]/edit.tsx`, `src/app/(app)/materials/[id]/index.tsx`, `src/app/(app)/(tabs)/inventory.tsx`.
- API mobile : `src/api/endpoints.ts` (`ordersApi.create` avec items, `ordersApi.replaceItems`, `inventoryApi.assignUnassigned`).
