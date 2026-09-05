from __future__ import annotations

from pathlib import Path

import numpy as np
import ollama
import pytest

from voicebox.knowledge import (
    HashEmbedder,
    Hit,
    KnowledgeBase,
    KnowledgeError,
    OllamaEmbedder,
    chunk_text,
    format_notes,
    read_document,
    title_for,
)

from .conftest import fixed_clock


# -- embedders -----------------------------------------------------------------


def test_hash_embedder_is_deterministic_and_unit_length():
    emb = HashEmbedder(dim=128)
    a, b = emb.embed(["the router password is hunter2", "the router password is hunter2"])
    assert a == b
    assert len(a) == 128
    assert abs(float(np.linalg.norm(a)) - 1.0) < 1e-5
    assert emb.embed([""])[0] == [0.0] * 128


def test_hash_embedder_similar_texts_score_higher():
    emb = HashEmbedder(dim=256)
    q, near, far = (np.asarray(v) for v in emb.embed(["wifi password", "the wifi password is on the fridge", "quarterly tax filing deadline"]))
    assert float(q @ near) > float(q @ far)


class FakeEmbedClient:
    def __init__(self, dim: int = 8, error: BaseException | None = None) -> None:
        self.dim = dim
        self.error = error
        self.calls: list[dict] = []

    def embed(self, model: str, input):  # noqa: A002 - mirrors ollama.Client.embed
        self.calls.append({"model": model, "input": list(input)})
        if self.error is not None:
            raise self.error
        return ollama.EmbedResponse(model=model, embeddings=[[float(len(t))] + [0.0] * (self.dim - 1) for t in input])


def test_ollama_embedder_probes_dimension_and_batches():
    client = FakeEmbedClient(dim=6)
    emb = OllamaEmbedder("nomic-embed-text", "http://127.0.0.1:11434", client=client, batch_size=2)
    assert emb.dim == 6
    assert emb.name == "ollama:nomic-embed-text:6"
    vectors = emb.embed(["a", "bb", "ccc"])
    assert [v[0] for v in vectors] == [1.0, 2.0, 3.0]
    assert [len(c["input"]) for c in client.calls] == [1, 2, 1]


def test_ollama_embedder_missing_model_hint():
    client = FakeEmbedClient(error=ollama.ResponseError("model 'nomic-embed-text' not found", 404))
    with pytest.raises(KnowledgeError, match="ollama pull nomic-embed-text"):
        OllamaEmbedder("nomic-embed-text", "http://127.0.0.1:11434", client=client)


def test_ollama_embedder_connection_failure():
    client = FakeEmbedClient(error=ConnectionError("refused"))
    with pytest.raises(KnowledgeError, match="cannot reach Ollama"):
        OllamaEmbedder("nomic-embed-text", "http://127.0.0.1:11434", client=client)


# -- chunking and reading --------------------------------------------------------


def test_chunk_text_keeps_short_text_whole():
    assert chunk_text("hello world") == ["hello world"]
    assert chunk_text("") == []


def test_chunk_text_splits_on_paragraphs_with_overlap():
    paras = [f"Paragraph {i} " + "word " * 40 for i in range(6)]
    chunks = chunk_text("\n\n".join(paras), size=500, overlap=100)
    assert len(chunks) > 1
    assert all(len(c) <= 500 + 100 + 2 for c in chunks)
    joined = " ".join(chunks)
    for i in range(6):
        assert f"Paragraph {i}" in joined


def test_chunk_text_splits_a_single_huge_paragraph():
    text = "alpha beta gamma delta " * 200
    chunks = chunk_text(text, size=300, overlap=50)
    assert len(chunks) >= 10
    assert all(len(c) <= 300 for c in chunks)
    assert chunks[-1].endswith("delta") or chunks[-1].endswith("gamma")


def test_chunk_text_rejects_bad_sizes():
    with pytest.raises(ValueError):
        chunk_text("x", size=100, overlap=100)


def test_read_document_text_and_markdown(tmp_path: Path):
    md = tmp_path / "a.md"
    md.write_text("# Title\n\nbody", encoding="utf-8")
    assert read_document(md) == "# Title\n\nbody"
    assert title_for(md, read_document(md)) == "Title"
    txt = tmp_path / "my_file-name.txt"
    txt.write_text("\n\n   \n", encoding="utf-8")
    assert title_for(txt, read_document(txt)) == "my file name"


def test_read_document_bad_pdf_is_knowledge_error(tmp_path: Path):
    pdf = tmp_path / "broken.pdf"
    pdf.write_bytes(b"not really a pdf")
    with pytest.raises(KnowledgeError, match="cannot read PDF"):
        read_document(pdf)


def test_read_document_real_pdf(tmp_path: Path):
    pypdf = pytest.importorskip("pypdf")
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 100 Td (Garage code 4321) Tj ET")
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    page[NameObject("/Contents")] = writer._add_object(stream)
    target = tmp_path / "doc.pdf"
    with target.open("wb") as handle:
        writer.write(handle)
    assert "Garage code 4321" in read_document(target)


# -- the knowledge base ------------------------------------------------------------


def write(kb: KnowledgeBase, rel: str, text: str) -> Path:
    path = kb.knowledge_dir / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def test_sync_adds_updates_and_removes(kb: KnowledgeBase):
    write(kb, "home/wifi.md", "# Home wifi\n\nThe wifi password is hunter2.")
    write(kb, "ignored.docx", "binary-ish")
    write(kb, ".hidden.md", "secret")
    report = kb.sync()
    assert report.added == ["home/wifi.md"]
    assert report.reindexed_all is True  # first run records the embedder
    assert report.changed

    second = kb.sync()
    assert second.unchanged == 1 and not second.changed and second.reindexed_all is False

    write(kb, "home/wifi.md", "# Home wifi\n\nThe wifi password is now hunter3.")
    third = kb.sync()
    assert third.updated == ["home/wifi.md"]

    (kb.knowledge_dir / "home" / "wifi.md").unlink()
    fourth = kb.sync()
    assert fourth.removed == ["home/wifi.md"]
    assert kb.stats()["documents"] == 0 and kb.stats()["chunks"] == 0


def test_sync_skips_the_folder_readme_but_not_nested_ones(kb: KnowledgeBase):
    write(kb, "README.md", "# Knowledge folder\n\nDrop files here.")
    write(kb, "manuals/README.md", "# Boiler manual\n\nReset button behind the panel.")
    report = kb.sync()
    assert report.added == ["manuals/README.md"]


def test_sync_force_reindexes_everything(kb: KnowledgeBase):
    write(kb, "a.md", "alpha")
    kb.sync()
    report = kb.sync(force=True)
    assert report.updated == ["a.md"] and report.unchanged == 0


def test_sync_reindexes_when_embedder_changes(tmp_path: Path):
    folder, db = tmp_path / "k", tmp_path / "k.db"
    first = KnowledgeBase(folder, db, HashEmbedder(dim=64))
    write(first, "a.md", "alpha bravo")
    first.sync()
    first.close()
    second = KnowledgeBase(folder, db, HashEmbedder(dim=128))
    report = second.sync()
    assert report.reindexed_all is True
    assert report.added == ["a.md"]
    assert len(second.search("alpha")) == 1
    second.close()


def test_sync_records_errors_per_file_and_continues(kb: KnowledgeBase):
    (kb.knowledge_dir / "bad.pdf").write_bytes(b"nope")
    write(kb, "good.md", "fine")
    report = kb.sync()
    assert "bad.pdf" in report.errors and "cannot read PDF" in report.errors["bad.pdf"]
    assert report.added == ["good.md"]


def test_add_note_writes_dated_file_and_indexes_it(kb: KnowledgeBase):
    clock = fixed_clock("2026-09-05 10:15:30")
    path = kb.add_note("The spare key is under the blue flower pot by the shed", clock=clock)
    assert path.parent == kb.knowledge_dir / "notes"
    assert path.name == "2026-09-05-101530-the-spare-key-is-under-the-blue-flower.md"
    text = path.read_text(encoding="utf-8")
    assert text.startswith("# The spare key is under the blue flower")
    assert "Saved 2026-09-05 10:15." in text
    hits = kb.search("where is the spare key")
    assert hits and hits[0].source == f"notes/{path.name}"
    # a second note in the same second gets a counter instead of overwriting
    again = kb.add_note("The spare key moved", title="The spare key is under the blue flower", clock=clock)
    assert again.name.endswith("-1.md")
    assert kb.stats()["documents"] == 2


def test_add_note_rejects_empty(kb: KnowledgeBase):
    with pytest.raises(ValueError):
        kb.add_note("   ")


def test_resolve_source_stays_inside_the_folder(kb: KnowledgeBase, tmp_path: Path):
    write(kb, "notes/a.md", "alpha")
    assert kb.resolve_source("notes/a.md") == (kb.knowledge_dir / "notes" / "a.md").resolve()
    for bad in ("../secret.md", "notes/../../secret.md", "/etc/passwd", "", "   ", "."):
        with pytest.raises(ValueError):
            kb.resolve_source(bad)
    # a symlink pointing outside the folder is refused too
    outside = tmp_path / "outside.md"
    outside.write_text("secret", encoding="utf-8")
    link = kb.knowledge_dir / "link.md"
    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not available")
    with pytest.raises(ValueError):
        kb.remove("link.md")
    assert outside.exists()


def test_remove_deletes_file_and_index(kb: KnowledgeBase):
    kb.add_note("Trash day is Tuesday", clock=fixed_clock())
    source = kb.sources()[0]["source"]
    assert kb.remove(source) is True
    assert not (kb.knowledge_dir / source).exists()
    assert kb.sources() == [] and kb.search("trash day") == []
    assert kb.remove("nope.md") is False


def test_search_ranks_relevant_chunk_first(kb: KnowledgeBase):
    write(kb, "wifi.md", "# Wifi\n\nThe guest wifi password is sunflower99.")
    write(kb, "car.md", "# Car\n\nThe car needs an oil change every five thousand miles.")
    write(kb, "taxes.md", "# Taxes\n\nQuarterly estimated taxes are due in April, June, September and January.")
    kb.sync()
    hits = kb.search("what is the guest wifi password", k=2)
    assert [h.source for h in hits][0] == "wifi.md"
    assert len(hits) <= 2
    assert hits[0].title == "Wifi" and hits[0].score > 0
    assert kb.search("   ") == []


def test_search_empty_index_and_dimension_mismatch(tmp_path: Path):
    kb = KnowledgeBase(tmp_path / "k", tmp_path / "k.db", HashEmbedder(dim=32))
    assert kb.search("anything") == []
    write(kb, "a.md", "alpha")
    kb.sync()
    kb.embedder = HashEmbedder(dim=64)  # index built with 32 dims, query with 64 -> must not crash silently
    with pytest.raises(KnowledgeError, match="different embedding model"):
        kb.search("alpha")
    kb.close()


def test_search_min_score_filters_unrelated(kb: KnowledgeBase):
    write(kb, "a.md", "zebra giraffe hippopotamus")
    kb.sync()
    assert kb.search("quantum chromodynamics lattice") == []  # the hash embedder's own floor is enough here
    assert kb.search("quantum chromodynamics lattice", min_score=-1.0) != []  # an explicit floor overrides it


class DenseLikeEmbedder:
    """Mimics a dense model: unrelated English texts still score about 0.4, related ones near 1."""

    name = "dense-fake"
    dim = 4
    min_score = 0.45

    def embed(self, texts):
        out = []
        for text in texts:
            t = text.lower()
            topic = [1.0 if "wifi" in t else 0.0, 1.0 if "car" in t else 0.0, 1.0 if "tax" in t else 0.0]
            vec = np.array([0.45, *topic], dtype=np.float32)  # the shared first component is the "it is English" similarity
            out.append((vec / np.linalg.norm(vec)).tolist())
        return out


def test_dense_embedder_floor_keeps_unrelated_notes_out(tmp_path: Path):
    kb = KnowledgeBase(tmp_path / "k", tmp_path / "k.db", DenseLikeEmbedder())
    write(kb, "wifi.md", "# Wifi\n\nThe wifi password is sunflower99.")
    write(kb, "car.md", "# Car\n\nThe car needs an oil change soon.")
    write(kb, "taxes.md", "# Taxes\n\nQuarterly tax payments are due in April.")
    kb.sync()
    assert [h.source for h in kb.search("what is the wifi password")] == ["wifi.md"]
    assert kb.search("tell me a joke") == []  # every note scores ~0.41 ("it is English"): below the dense floor, nothing is attached
    assert len(kb.search("tell me a joke", min_score=0.0)) == 3  # the old behaviour, for comparison
    kb.close()


def test_gap_filter_drops_hits_far_below_the_best(kb: KnowledgeBase):
    write(kb, "wifi.md", "# Wifi\n\nThe guest wifi password is sunflower99.")
    write(kb, "guest.md", "# Guest room\n\nThe guest room has a blue blanket and two pillows.")
    kb.sync()
    everything = kb.search("what is the guest wifi password", max_gap=10.0)
    assert [h.source for h in everything] == ["wifi.md", "guest.md"]  # both clear the hash floor
    gapped = kb.search("what is the guest wifi password")
    assert [h.source for h in gapped] == ["wifi.md"]
    assert everything[1].score < everything[0].score - 0.12


def test_sources_and_stats(kb: KnowledgeBase):
    write(kb, "b.md", "# Bravo\n\ntext")
    write(kb, "a.md", "# Alpha\n\ntext")
    kb.sync()
    sources = kb.sources()
    assert [s["source"] for s in sources] == ["a.md", "b.md"]
    assert sources[0]["title"] == "Alpha" and sources[0]["chunks"] == 1
    stats = kb.stats()
    assert stats["documents"] == 2 and stats["embedder"] == "hash:256" and stats["folder"] == str(kb.knowledge_dir)


def test_knowledge_base_is_safe_under_concurrent_use(kb: KnowledgeBase):
    import random
    import threading

    errors: list[BaseException] = []

    def worker(n: int) -> None:
        rng = random.Random(n)
        clock = fixed_clock(f"2026-09-05 10:{n:02d}:00")
        try:
            for i in range(25):
                op = rng.choice(["note", "search", "sync", "sources", "remove"])
                if op == "note":
                    kb.add_note(f"worker {n} note {i} topic {rng.randint(1, 5)}", clock=clock)
                elif op == "search":
                    kb.search("topic 3")
                elif op == "sync":
                    kb.sync()
                elif op == "sources":
                    kb.sources()
                else:
                    sources = kb.sources()
                    if sources:
                        try:
                            kb.remove(rng.choice(sources)["source"])
                        except ValueError:
                            pass
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert not any(t.is_alive() for t in threads)
    assert errors == []
    stats = kb.stats()
    assert stats["documents"] == len(kb.sources()) and stats["chunks"] >= stats["documents"]


def test_format_notes_layout():
    hits = [Hit("notes/a.md", "Alpha", "  alpha body  ", 0.9), Hit("b.md", "Bravo", "bravo body", 0.5)]
    text = format_notes(hits)
    assert text.startswith("### Notes\n")
    assert "[Note: Alpha | file: notes/a.md]\nalpha body" in text
    assert "[Note: Bravo | file: b.md]\nbravo body" in text
