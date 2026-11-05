export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Character #{id}</h1>
      <p className="muted">
        Scaffold only. Stats, XP, equipped items, inventory and the upgrade / equip / unequip
        actions go here (docs/SCOPE.md, Screen 2).
      </p>
    </section>
  );
}
