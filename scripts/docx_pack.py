# Minimal .docx (OPC/ZIP) unpack/repack helper for the template build pipeline.
# A .docx is a plain ZIP, so we just extract / re-zip the package directory.
#   py scripts/docx_pack.py unpack <src.docx> <dest_dir>
#   py scripts/docx_pack.py pack   <src_dir>  <out.docx>
import sys, os, zipfile, shutil

def unpack(src, dest):
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    with zipfile.ZipFile(src) as z:
        z.extractall(dest)

def pack(srcdir, out):
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _dirs, files in os.walk(srcdir):
            for f in files:
                full = os.path.join(root, f)
                arc = os.path.relpath(full, srcdir).replace(os.sep, '/')
                z.write(full, arc)

if __name__ == '__main__':
    cmd, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    {'unpack': unpack, 'pack': pack}[cmd](a, b)
    print(cmd, 'ok:', b)
