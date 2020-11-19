import argparse
import sys
import re
import base64

parser = argparse.ArgumentParser(description='')
parser.add_argument('input', type=str, help='input')
parser.add_argument('path', type=str, help='input')
parser.add_argument('--output', type=str, default="", help='output')
parser.add_argument('--mime', type=str, default="auto", help='mime')

args = parser.parse_args()



def ClassName(i):
  return  "K_" + base64.urlsafe_b64encode(i.encode()).rstrip(b"=").decode()

def GetMime(i, m):
  if m != "auto":
    return m
  if i.endswith('.html'): return 'text/html'
  if i.endswith('.css'): return 'text/css'
  return "application/octet-stream"

def HexContent(c):
  return ','.join(map(hex, c))
  
def main(args):
  i = open(args.input, "rb")
  o = sys.stdout
  if args.output:
    o = open(args.output, "w")
  classname = ClassName(args.input)
  m = GetMime(args.input, args.mime)
  
  o.write("""#include "../httplib.h"
#include <vector>

typedef void (*SvrRegister)(httplib::Server&);
extern std::vector<SvrRegister>* v;

static const unsigned char content[] = {"""
  + HexContent(i.read()) + 
"""};

namespace UI_GEN{
  
  
  static void register_func(httplib::Server& srv){
    srv.Get(\"""" + args.path + """\", [](const httplib::Request &req, httplib::Response &res) {
			res.set_content((const char*)content, sizeof(content), \"""" + m + """\");
		});
  }

  struct """ + classname + """{
    """ + classname + """(){
      if (!v){
        v = new std::vector<SvrRegister>();
      }
      v->push_back(register_func);
    }
  };
  
  static """ + classname + """ _unused;

}
""")
  o.close()

print(args)
main(args)


