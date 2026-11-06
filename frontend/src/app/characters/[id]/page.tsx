import CharacterView from "@/components/CharacterView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return <p>Invalid character ID.</p>;
  return <CharacterView id={n} />;
}
