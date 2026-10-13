"""
Vector Store Module — Handles PDF processing, embedding, and Pinecone vector store management.
"""
import os
import hashlib
import time
from datetime import datetime
from typing import List

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from langchain_core.documents import Document
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import re

try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

try:
    from pptx import Presentation
except ImportError:
    Presentation = None

# Initialize Pinecone index name
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "multi-agentic-rag")


def get_embedding_model(api_key: str, retries: int = 3, backoff_factor: int = 2):
    """Create embedding model with retry logic."""
    for attempt in range(retries):
        try:
            embedding_model = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=api_key,
            )
            _ = embedding_model.embed_query("connectivity probe")
            return embedding_model
        except Exception as e:
            if attempt < retries - 1:
                delay = backoff_factor ** attempt
                time.sleep(delay)
            else:
                raise Exception(f"Failed to initialize embedding model after {retries} attempts: {e}")


def get_file_hash(file_path: str) -> str:
    """Compute MD5 hash of any uploaded file."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

get_pdf_hash = get_file_hash  # backwards compatibility


def init_pinecone_index():
    """Ensure the Pinecone index exists, create if not."""
    pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
    existing_indexes = [index.name for index in pc.list_indexes()]
    if PINECONE_INDEX_NAME not in existing_indexes:
        print(f"Creating Pinecone index: {PINECONE_INDEX_NAME}")
        pc.create_index(
            name=PINECONE_INDEX_NAME,
            dimension=3072,  # gemini-embedding-001 dimension
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
    return pc


def extract_text_from_file(file_path: str, original_filename: str) -> List[Document]:
    """
    Extract text from PDF, DOCX, DOC, PPTX, PPT, TXT, or MD files into LangChain Documents.
    """
    ext = os.path.splitext(original_filename.lower())[1]

    # 1. PDF Documents
    if ext == ".pdf":
        loader = PyMuPDFLoader(file_path)
        return loader.load()

    # 2. Word Documents (.docx, .doc)
    if ext in [".docx", ".doc"]:
        if DocxDocument is not None:
            try:
                doc = DocxDocument(file_path)
                full_text = []
                for p in doc.paragraphs:
                    t = p.text.strip()
                    if t:
                        full_text.append(t)
                for table in doc.tables:
                    for row in table.rows:
                        row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_text:
                            full_text.append(" | ".join(row_text))
                content = "\n\n".join(full_text)
                if content.strip():
                    return [Document(page_content=content, metadata={"source": original_filename})]
            except Exception as e:
                print(f"[DOCX/DOC Loader Warning] python-docx could not parse {original_filename}: {e}")

        # Fallback for binary .doc or malformed docx (extract printable character blocks)
        try:
            with open(file_path, "rb") as f:
                raw_bytes = f.read()
            ascii_strings = re.findall(rb'[\x20-\x7E\t\n\r]{4,}', raw_bytes)
            extracted = [s.decode('latin-1', errors='ignore').strip() for s in ascii_strings if len(s.strip()) > 3]
            text = "\n\n".join([line for line in extracted if not line.startswith('<xml') and not line.startswith('<?xml')])
            if text.strip():
                return [Document(page_content=text, metadata={"source": original_filename})]
        except Exception as e:
            print(f"[Binary DOC Fallback Error] {e}")

    # 3. PowerPoint Presentations (.pptx, .ppt)
    if ext in [".pptx", ".ppt"]:
        if Presentation is not None:
            try:
                prs = Presentation(file_path)
                docs = []
                for slide_idx, slide in enumerate(prs.slides, 1):
                    slide_texts = []
                    for shape in slide.shapes:
                        if shape.has_text_frame:
                            for paragraph in shape.text_frame.paragraphs:
                                t = paragraph.text.strip()
                                if t:
                                    slide_texts.append(t)
                        elif shape.has_table:
                            for row in shape.table.rows:
                                row_t = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                                if row_t:
                                    slide_texts.append(" | ".join(row_t))
                    if slide_texts:
                        docs.append(Document(
                            page_content="\n".join(slide_texts),
                            metadata={"source": original_filename, "slide": slide_idx}
                        ))
                if docs:
                    return docs
            except Exception as e:
                print(f"[PPTX Loader Warning] python-pptx could not parse {original_filename}: {e}")

        # Fallback for binary .ppt
        try:
            with open(file_path, "rb") as f:
                raw_bytes = f.read()
            ascii_strings = re.findall(rb'[\x20-\x7E\t\n\r]{4,}', raw_bytes)
            extracted = [s.decode('latin-1', errors='ignore').strip() for s in ascii_strings if len(s.strip()) > 3]
            text = "\n\n".join(extracted)
            if text.strip():
                return [Document(page_content=text, metadata={"source": original_filename})]
        except Exception as e:
            print(f"[Binary PPT Fallback Error] {e}")

    # 4. Plain text / Markdown fallback
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        if text.strip():
            return [Document(page_content=text, metadata={"source": original_filename})]
    except Exception as e:
        print(f"[Text Read Error] {e}")

    return [Document(page_content=f"Uploaded file {original_filename}", metadata={"source": original_filename})]


def process_document(file_path: str, original_filename: str, embedding_model) -> PineconeVectorStore:
    """Process a single document (PDF, DOCX, DOC, PPTX, PPT, TXT) and upsert to Pinecone."""
    file_hash = get_file_hash(file_path)

    # Ensure index exists
    init_pinecone_index()

    documents = extract_text_from_file(file_path, original_filename)
    for doc in documents:
        doc.metadata.update({
            "source": original_filename,
            "hash": file_hash,
            "uploaded_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

    splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200)
    docs = splitter.split_documents(documents)
    print(f"Split {original_filename} into {len(docs)} chunks.")

    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embedding_model
    )

    # Upsert in batches with automatic retry on 429 rate limits
    batch_size = 20
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        max_retries = 5
        for attempt in range(max_retries):
            try:
                vectorstore.add_documents(batch)
                time.sleep(0.4)  # throttle slightly to stay under quota
                break
            except Exception as e:
                err_str = str(e)
                if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str) and attempt < max_retries - 1:
                    wait_time = 8 * (attempt + 1)
                    print(f"[RATE LIMIT] Gemini quota exceeded. Retrying batch {i//batch_size + 1} in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise e

    return vectorstore


def process_pdf(file_path: str, original_filename: str, embedding_model) -> PineconeVectorStore:
    """Backwards-compatible alias for process_document."""
    return process_document(file_path, original_filename, embedding_model)


def build_retriever(file_paths: List[dict], embedding_model):
    """
    Build a Pinecone retriever from multiple PDFs.
    file_paths: list of {"path": str, "name": str}
    """
    namespaces = []
    for fp in file_paths:
        process_pdf(fp["path"], fp["name"], embedding_model)
        namespaces.append(get_pdf_hash(fp["path"]))

    if not namespaces:
        return None

    # Return a retriever that searches across all namespaces uploaded
    # Note: If searching across multiple namespaces is not supported in a single retriever call easily,
    # we can just use the default namespace for all, and filter by hash instead.
    # For now, we will just use the index and let it retrieve from the entire index (ignoring namespace in retriever).
    # To be more precise, let's just initialize a single retriever.
    
    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME, 
        embedding=embedding_model
    )
    
    # Filter by the specific hashes uploaded in this session
    return vectorstore.as_retriever(search_kwargs={
        "k": 10,
        "filter": {"hash": {"$in": namespaces}}
    })

def get_global_retriever(embedding_model):
    """Return a retriever that searches the entire index without filtering."""
    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME, 
        embedding=embedding_model
    )
    return vectorstore.as_retriever(search_kwargs={"k": 10})
