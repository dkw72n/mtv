// analyzer.cpp : This file contains the 'main' function. Program execution begins and ends there.
// compile:
//   https://stackoverflow.com/questions/35116327/when-g-static-link-pthread-cause-segmentation-fault-why
//   g++ analyzer.cpp  --std=c++17 -lstdc++fs -O3 -o analyzer -g -static -lrt -pthread -Wl,--whole-archive -lpthread -Wl,--no-whole-archive
// 

#include "httplib.h"
#include <assert.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <map>
#include <set>
#include <memory>
#ifdef WIN32
#include <conio.h>
#endif
#include <deque>
#include <iomanip>
#include <experimental/filesystem>
#include <mutex>
#include <chrono>

#define TPT_COMMIT                      0x00001000  
#define TPT_RESERVE                     0x00002000  
#define TPT_DECOMMIT                    0x00004000  
#define TPT_RELEASE                     0x00008000

#define LOGI (std::cerr << "I [" << __FUNCTION__ << "] ")
#define LOGE (std::cerr << "E [" << __FUNCTION__ << "] ")
#define LOGW (std::cerr << "W [" << __FUNCTION__ << "] ")
#define MYHEX(n) std::setfill('0') << std::setw(n) << std::hex

typedef void (*SvrRegister)(httplib::Server&);
std::vector<SvrRegister>* v;

class StackDb;
class Report;
namespace Config {
	static uint64_t threshold = 0;
	static bool reverse = false;
	static bool page = false;
	static int multiplier = 1;
	static int port = 9001;
	static std::string host = "127.0.0.1";
	static std::string tracker = "malloc";
	static std::string filename;
	static std::string wwwdir = "www";
	static bool smoke = false;
};
/*
static std::string escape(std::string k) {
	std::ostringstream oss;
	int o = 0;
	size_t found = std::string::npos;
	while ((found = k.find('\\', o)) != std::string::npos) {
		oss << k.substr(o, found - o);
		oss << "\\\\";
		o = found + 1;
	}
	oss << k.substr(o);
	return oss.str();
}
*/
static std::string escape(const std::string &s) {
	std::ostringstream o;
	for (auto c = s.cbegin(); c != s.cend(); c++) {
		if (*c == '"' || *c == '\\' || ('\x00' <= *c && *c <= '\x1f')) {
			o << "\\u"
				<< std::hex << std::setw(4) << std::setfill('0') << (int)*c;
		}
		else {
			o << *c;
		}
	}
	return o.str();
}

class TreeNode {
	std::unordered_map<uint64_t, std::shared_ptr<TreeNode>> _children; // (pc => node)
	std::shared_ptr<TreeNode> _parent;
	int _id;
	uint64_t _pc;
	friend StackDb;
	friend Report;
};

class Events {
public:
	Events(int pid) {
		std::string fn;
		std::string line;
		std::ostringstream oss;
		std::experimental::filesystem::path p = Config::filename;
		oss << "events." << pid << ".txt";
		p.replace_filename(oss.str());
		fn = p.string();
		std::ifstream infile(fn);
		if (!infile.bad()) {
			while (std::getline(infile, line))
			{
				std::istringstream iss(line);
				std::ostringstream detail;
				uint64_t ts;
				char _dummy; // space
				if (iss >> ts >> std::noskipws >> _dummy >> detail.rdbuf()) {
					_events.push_back(std::make_pair(ts, escape(detail.str())));
					//std::cout << "pc[" << pc << "] = r'" << detail.str() << "'\n";
				}
			}
			std::sort(_events.begin(), _events.end());
		}
	}

private:
	std::vector<std::pair<uint64_t, std::string>> _events;
	friend Report;
};
class StackDb {
	std::unordered_map<uint64_t, std::string> _pcs;
	std::vector<std::shared_ptr<TreeNode>> _nodes;
	std::unordered_map<uint64_t, std::shared_ptr<TreeNode>> _bt_nodes;
	std::unordered_map<uint64_t, std::vector<uint64_t>> _bt_pcs;
	std::shared_ptr<TreeNode> _root;
public:
	StackDb(int pid) {
		std::string fn;
		std::string line;
		std::ostringstream oss;
		std::experimental::filesystem::path p = Config::filename;
		oss << "stacks." << pid << ".txt";
		p.replace_filename(oss.str());
		fn = p.string();
		std::ifstream infile(fn);

		while (std::getline(infile, line))
		{
			std::istringstream iss(line);
			char evt;
			if (!(iss >> evt)) {
				break;
			}
			switch (evt) {
			case '$':
				break;
			case '>': // stack
			{
				uint64_t bt;
				std::string detail;
				if (iss >> std::hex >> bt >> detail) {
					std::string pc;
					auto& pcs = _bt_pcs[bt];
					std::istringstream iss2(detail);
					while (std::getline(iss2, pc, '|')) {
						// std::cout << pc << "\n";
						if (pc.size()) {
							uint64_t _pc;
							std::istringstream iss2(pc);
							if (iss2 >> std::hex >> _pc) {
								pcs.push_back(_pc);
							}
						}
					}
					if (!Config::reverse)
						std::reverse(pcs.begin(), pcs.end());
					// std::cout << "bt[" << bt << "] = [" << pcs.size() << "]\n";
				}
				break;
			}	
			case '#': // pc
			{
				uint64_t pc;
				char _dummy;
				std::ostringstream detail;
				if (iss >> std::hex >> pc >> std::noskipws >> _dummy >> detail.rdbuf()) {
					_pcs.insert(std::make_pair(pc, escape(detail.str())));
					//std::cout << "pc[" << pc << "] = r'" << detail.str() << "'\n";
				}
				break;
			}
			}
		}
		infile.close();
		LOGI << fn << " loaded, " << _pcs.size() << " pcs, " << _bt_pcs.size() << " bts." << std::endl;
		_root.reset(new TreeNode());
		_add_node(_root);
		_bt_nodes[0] = _root;
	}

	void _add_bt_to_tree(uint64_t bt) {
		if (_bt_nodes.find(bt) == _bt_nodes.end()) {
			auto& pcs = _bt_pcs[bt];
			std::shared_ptr<TreeNode> cur = _root;
			for (auto& pc : pcs) {
				if (cur->_children.find(pc) == cur->_children.end()) {
					std::shared_ptr<TreeNode> node;
					node.reset(new TreeNode());
					_add_node(node);
					node->_pc = pc;
					node->_parent = cur;
					cur->_children.insert(std::make_pair(pc, node));
				}
				cur = cur->_children.find(pc)->second;
			}
			assert(cur);
			_bt_nodes[bt] = cur;
		}
	}
	void _add_node(std::shared_ptr<TreeNode> node) {
		_nodes.push_back(node);
		auto idx = _nodes.size() - 1;
		node->_id = idx;
	}
	friend Report;
};

class ReportManager;

class ITracker {
public:
	typedef std::vector<std::pair<uint64_t, int64_t>> UpdateList;
	virtual UpdateList map(uint64_t base, uint64_t len, uint64_t bt) = 0;
	virtual UpdateList unmap(uint64_t base, uint64_t len) = 0;
	virtual ~ITracker() {};
};

class MapTracker: public ITracker {
	struct MapInfo {
		uint64_t len;
		uint64_t bt;
	};

	std::map<uint64_t, MapInfo> _m; // addr => mapinfo
	std::map<std::pair<uint64_t, uint64_t>, uint64_t> _owner; // (addr, len) => bt

	std::deque<std::pair<uint64_t, uint64_t>> _q;

	
public:
	virtual UpdateList map(uint64_t base, uint64_t len, uint64_t bt) {
		UpdateList ret;
		MapInfo mi = { len, bt };
		_decommit_range(ret, base, base + len);
		_m[base] = mi;
		ret.push_back(std::make_pair(bt, (int64_t)len));
		return ret;
	}

	virtual UpdateList unmap(uint64_t base, uint64_t len) {
		UpdateList ret;
		_decommit_range(ret, base, base + len);
		return ret;
	}

private:
	void _decommit_range(UpdateList& ul, uint64_t left, uint64_t right) {
		auto it1 = _m.lower_bound(left);
		auto it2 = _m.upper_bound(right);
		if (it1 == _m.end()) it1 = _m.begin();
		while (it1 != it2) {
			if (it1->first + it1->second.len > left && it1->first < right) {
				ul.push_back(std::make_pair(it1->second.bt, -((int64_t)it1->second.len)));
				_m.erase(it1++);
			}
			else {
				it1++;
			}
		}
	}
};

class MallocTracker: public ITracker {

	struct MapInfo {
		uint64_t len;
		uint64_t bt;
	};
	int c;
	int d;
	std::map<uint64_t, MapInfo> _m; // addr => mapinfo

public:
	virtual UpdateList map(uint64_t base, uint64_t len, uint64_t bt) {
		UpdateList ret;
		MapInfo mi = { len, bt };
		c++;
		if (_m.find(base) != _m.end()) {
			LOGE << "duplicated allocation: " << std::hex << base << std::dec << std::endl;
			if (Config::smoke) {
				abort();
			}
			unmap(base, 0);
		}
		_m[base] = mi;
		ret.push_back(std::make_pair(bt, (int64_t)len));
		return ret;
	}

	virtual UpdateList unmap(uint64_t base, uint64_t len) {
		UpdateList ret;
		d--;
		auto it = _m.find(base);
		if (it != _m.end()) {
			int64_t len = it->second.len;
			ret.push_back(std::make_pair(it->second.bt, -len));
			_m.erase(base);
		}
		return ret;
	}

};

class Report {
public:
	struct Range {
		uint64_t left;  // included
		uint64_t right; // included
		int64_t bottom;
		int64_t top;

		// @param buckets: buckets 数量
		// @param idx: bucket 序号
		// @return: 当前 bucket 所在的最大标值
		//			bucket[0] 只有一个值 => left
		//			bucket[last] 只有一个值 => right
		//			bucket[last - 1] => right - 1
		uint64_t hnext(int buckets, int idx) const {
			// hi(0) = left, hi(buckets - 2) = right - 1;
			if (idx == 0) return left;
			if (idx == buckets - 2) return right - 1;
			return (right - 1 - left) * idx / (buckets - 2) + left;
		} // TODO: add unittest

		bool bucket2(int buckets, int idx, uint64_t& b, uint64_t& e) const {
			// hi(0) = left, hi(buckets - 2) = right - 1;
			if (buckets < 3) return false;
			if (idx < 0 || idx >= buckets) return false;
			if (idx == 0) {
				b = left;
				e = left + 1;
				return true;
			}
			if (idx == buckets - 1) {
				b = right;
				e = right + 1;
				return true;
			}
			b = (right - (left + 1)) * (idx - 1) / (buckets - 2) + (left + 1);
			e = (right - (left + 1)) * idx / (buckets - 2) + (left + 1);
			return true;
		} // TODO: add unittest

		int bucket(uint64_t value, int buckets) {
			if (value < left) return -1;
			if (value > right) return -1;
			if (value == left) return 0;
			if (value == right) return buckets - 1;
			return (value - left - 1) * (buckets - 2) / (right - 1 - left) + 1;
		} // TODO: add unittest
	};

	struct Rect {
		uint64_t left;
		uint64_t right;
		int layer;
	};

private:
	StackDb _db;
	Events _events;
	ITracker* _tracker;
	std::vector<std::vector<std::pair<uint64_t, int64_t>>> _lines;
	std::vector<std::pair<uint64_t, int64_t>> _dummy_line;
	int64_t _sum;
	int64_t _points;
	int64_t _unknown;
	Range _range;
	std::vector<Rect> _rect;
	std::mutex _rect_mutex;

	Report(int pid) :_db(pid), _events(pid), _sum(0), _points(0), _unknown(0) {
		_lines.resize(_db._nodes.size());
		_rect.resize(_db._nodes.size());
		if (Config::tracker == "malloc") {
			_tracker = new MallocTracker;
		}
		else {
			_tracker = new MapTracker;
		}
	}

#define UPDATE_RANGE(ts, n) do { \
	uint64_t _ts = (ts); \
	int64_t _n = (n); \
	if (_range.left > _ts)  _range.left = _ts; \
	if (_range.right < _ts)  _range.right = _ts; \
	if (_range.top < _n) _range.top = _n; \
	if (_range.bottom > _n) _range.bottom = _n; \
}while(0)

	void _push_point(int node, uint64_t ts, int64_t d) {

		if (_points == 0) {
			_range.left = _range.right = ts;
			_range.bottom = _range.top = 0;
		}

		if (_lines[node].size() == 0) {
			_lines[node].push_back(std::make_pair(ts, d));
			UPDATE_RANGE(ts, d);
			_points++;
			return;
		}
		else {
			auto last = _lines[node].rbegin();
			if (ts == last->first) {
				last->second += d;
				UPDATE_RANGE(ts, last->second);
			}
			else {
				UPDATE_RANGE(ts, last->second + d);
				_lines[node].push_back(std::make_pair(ts, last->second + d));
				_points++;
			}
		}
	}

	uint64_t _get_width(uint64_t ts, std::shared_ptr<TreeNode>& node) {
		auto& line = _lines[node->_id];
		//auto found = std::lower_bound(line.begin(), line.end(), std::make_pair(ts, (int64_t)-1000000000));
		//if (found != line.end())
		//	return found->second;
		auto v = std::make_pair(ts, (int64_t)-1000000000);
		int l = 0, r = line.size(), m;
		if (r == l) return 0;
		if (line[l] >= v) return 0;
		while (l + 1< r) {
			m = (l + r) / 2;
			if (line[m] < v)
				l = m;
			else
				r = m;
		}
		return line[l].second;
	}
	uint64_t _make_rect(uint64_t ts, std::shared_ptr<TreeNode> node, uint64_t offset, int layer) {
		auto width = _get_width(ts, node);
		auto& rect = _rect[node->_id];
		rect.left = offset;
		rect.right = offset + width;
		rect.layer = layer;
		for (auto& p : node->_children) {
			auto child = p.second;
			offset += _make_rect(ts, child, offset, layer + 1);
		}
		if (offset > rect.right) {
			LOGE << "out of bound graph found, " << std::dec << width << "," << offset - rect.left
				 << " ts:" << MYHEX(16) <<ts << " pc:"  << node->_pc
				<< "\n";
			int i = 0;
			for (auto& p : _lines[node->_id]) {
				LOGE << "\t" << MYHEX(16) << p.first << "," << p.second << std::endl;
				if (i++ > 10) break;
			}
			// exit(1);
		}
		if (width < 0) {
			LOGE << "negative width found\n";
		}
		return width;
	}
#undef UPDATE_RANGE
	void _test_bt_covers_all_nodes() {
		std::vector<bool> flags(_lines.size());
		for (auto& p : _db._bt_nodes) {
			auto bt = p.first;
			auto node = p.second;
			while (node && flags[node->_id] == false) {
				flags[node->_id] = true;
				node = node->_parent;
			}
		}
		for (auto f : flags) {
			if (!f) {
				LOGE << "test failed\n";
				return;
			}
		}
		LOGI << "test pass\n";
	}

	void _test_no_line_should_be_empty() {
		// make sure no line is empty
		int i = 0;
		for (auto& line : _lines) {
			if (line.size() == 0) {
				LOGE << "line " << i << " is empty!\n";
				auto node = _db._nodes[i];
				while (!node->_children.empty()) // find leaf node
					node = node->_children.begin()->second;
				for (auto& p : _db._bt_nodes) {
					if (p.second == node) {
						LOGE << "\t bt is " << MYHEX(16) << p.first << "\n";
						break;
					}
				}
				return;
			}
			++i;
		}
		LOGI << "test pass\n";
	}
public:
	~Report() {
		delete _tracker;
	}
	int64_t sum() const{
		return _sum;
	}

	int64_t points() const{
		return _points;
	}

	int64_t unknown() const{
		return _unknown;
	}

	const Range& range() const{
		return _range;
	}
	std::string& bt(int i){
		return _db._pcs[_db._nodes[i]->_pc];
	}
	void process(uint32_t flag, uint64_t base, uint64_t len, uint64_t bt, uint64_t ts){
		MapTracker::UpdateList tl;
		if (flag & TPT_COMMIT) {
			_db._add_bt_to_tree(bt);
			_lines.resize(_db._nodes.size());
			_rect.resize(_db._nodes.size());
			tl = _tracker->map(base, len, bt);
			// LOGI << "commit: " << std::hex << base << "\n";
		}
		else if (flag & (TPT_RELEASE|TPT_DECOMMIT)) {
			tl = _tracker->unmap(base, len);
			// LOGI << "decomm: " << std::hex << base << "\n";
		}
		else {
			LOGE << "ignore flag: " << std::hex << flag << "\n";
		}
		
		for (auto& i : tl) {
			auto bt = i.first;
			auto d = i.second;
			_sum += d;
			auto node = _db._bt_nodes[bt];
			
			if (node == nullptr) {
				LOGW << "unknown bt: " << MYHEX(16) << bt << std::endl;
				_push_point(0, ts, d);
				_unknown += d;
			}
			
			while (node) {
				assert(_lines.size() > node->_id);
				_push_point(node->_id, ts, d);
				node = node->_parent;
			}
		}
		
	}
	const std::vector<std::pair<uint64_t, int64_t>>& line(int id) {
		if (id >= _lines.size()) {
			return _dummy_line;
		}
		return _lines[id];
	}

	const std::vector<Rect>& rect(uint64_t ts) {
		std::lock_guard<std::mutex> lg(_rect_mutex);
		std::chrono::high_resolution_clock::time_point t1 = std::chrono::high_resolution_clock::now();
		auto _tmp = _make_rect(ts, _db._root, 0, 0);
		std::chrono::high_resolution_clock::time_point t2 = std::chrono::high_resolution_clock::now();
		std::chrono::duration<float, std::micro> time_span = std::chrono::duration_cast<std::chrono::duration<float, std::micro>>(t2 - t1);
		LOGI << "[rect] width: " << ts << "," << _tmp << ", " << time_span.count() << " us" << std::endl;
		return _rect;
	}

	const std::vector<std::pair<uint64_t, std::string>>& events() {
		return _events._events;
	}

	void check() {
		_test_bt_covers_all_nodes();
		_test_no_line_should_be_empty();
		rect(_range.left);
	}
	friend ReportManager;
};

class ReportManager {

	std::unordered_map<int, std::shared_ptr<Report>> _rpts;

public:
	static ReportManager* getInstance() {
		static ReportManager* ret = nullptr;
		if (ret == nullptr) {
			ret = new ReportManager();
		}
		return ret;
	}

	std::shared_ptr<Report> load(int pid) {
		auto it = _rpts.find(pid);
		if (it == _rpts.end()) {
			std::shared_ptr<Report> rpt;
			rpt.reset(new Report(pid)); // std::make_shared not work here
			auto ret = _rpts.insert(std::make_pair(pid, rpt));
			return ret.first->second;
		}
		return it->second;
	}

	std::shared_ptr<Report> pick_one() {
		auto it = _rpts.begin();
		if (it != _rpts.end()) {
			return it->second;
		}
		return nullptr;
	}
	void dump() {
		for (auto& p : _rpts) {
			auto rpt = p.second;
			LOGI << "report_" << p.first << ":\n";
			LOGI << std::dec
				<< " size: " << rpt->sum() * Config::multiplier
				<< ", nodes: " << rpt->_lines.size()
				<< ", points: " << rpt->points()
				<< ", unknown: " << rpt->unknown() * Config::multiplier
				<< std::endl;
		}
	}

	void test() {
		for (auto& p : _rpts) {
			auto rpt = p.second;
			LOGI << "report_" << p.first << ":\n";
			auto total = rpt->_lines[0].size();
			int bucket = total / 50;
			if (!bucket) bucket = 1;
			int i = 0;
			for (auto& pp : rpt->_lines[0]) {
				i++;
				if (i % bucket == 0) {
					LOGI << "\t" << pp.first << ", " << pp.second * Config::multiplier << "\n";
				}
			}
			LOGI << "\t" << rpt->_lines[0].rbegin()->first << ", " << rpt->_lines[0].rbegin()->second * Config::multiplier << "\n";
			rpt->check();
		}
	}
};

class Api {
	std::shared_ptr<TreeNode> get_tree() {

	}
	std::vector<uint64_t> get_trend(int node) {
		std::vector<uint64_t> ret;
		return ret;
	}
	std::vector<uint64_t> get_values(uint64_t ts) {
		std::vector<uint64_t> ret;
		return ret;
	}
	std::vector<uint64_t> get_values(uint64_t ts1, uint64_t ts2) {
		std::vector<uint64_t> ret;
		return ret;
	}
	std::vector<void*> get_map(uint64_t ts) {
		std::vector<void*> ret;
		return ret;
	}
	std::vector<void*> get_map(uint64_t ts1, uint64_t ts2) {
		std::vector<void*> ret;
		return ret;
	}
};

static void process(int pid, uint32_t flag, uint64_t base, uint64_t len, uint64_t bt, uint64_t ts) {
	auto rpt = ReportManager::getInstance()->load(pid);
	rpt->process(flag, base, len, bt, ts);
	if (ts % 100000 == 1) {
		LOGI << std::dec 
			<<	"cur size: " << rpt->sum() * Config::multiplier
			<< ", points: " << rpt->points() 
			<< ", unknown: " << rpt->unknown() * Config::multiplier
			<< std::endl;
	}

}

static std::string dump_headers(const httplib::Headers &headers) {
	std::string s;
	char buf[BUFSIZ];

	for (auto it = headers.begin(); it != headers.end(); ++it) {
		const auto &x = *it;
		snprintf(buf, sizeof(buf), "%s: %s\n", x.first.c_str(), x.second.c_str());
		s += buf;
	}

	return s;
}

static void print_help(std::string msg) {

	std::cerr << msg << std::endl;
	std::cerr << "usage: analyzer.exe [-page] [-reverse] [-port port] filename" << std::endl;
	std::cerr << std::endl;
	std::cerr << "arguments:" << std::endl;
	std::cerr << "   filename: mmtrace.txt" << std::endl;
	std::cerr << "   -page: measure size in pages" << std::endl;
	std::cerr << "   -reverse: display callcstack upside down" << std::endl;
	std::cerr << "   -port <port>: listening port, default 9001 " << std::endl;
	std::cerr << "   -threshold <value>: only show callstacks whose value is above threshold" << std::endl;

}

static bool prepare_config(int argc, char** argv) {
	for (int i = 1; i < argc; ++i) {
		std::string arg(argv[i]);
		if (arg[0] != '-') {
			Config::filename = arg;
			continue;
		}
		if (arg == "-page") {
			Config::page = true;
			Config::multiplier = 4096;
			continue;
		}
		if (arg == "-reverse") {
			Config::reverse = true;
			continue;
		}
		if (arg == "-port") {
			if (i + 1 < argc) {
				Config::port = atoi(argv[i + 1]);
				if (Config::port > 0 && Config::port < 65536) {
					i++;
					continue;
				}
			}
		}
		if (arg == "-host") {
			if (i + 1 < argc) {
				Config::host = argv[i + 1];
				i++;
				continue;
			}
		}
		if (arg == "-tracker") {
			if (i + 1 < argc) {
				Config::tracker = argv[i + 1];
				if (Config::tracker == "mmap" || Config::tracker == "malloc") {
					i++;
					continue;
				}
			}
		}
		if (arg == "-threshold") {
			if (i + 1 < argc) {
				Config::threshold = strtoull(argv[i + 1], NULL, 10);
				i++;
				continue;
			}
		}
		if (arg == "-wwwdir") {
			if (i + 1 < argc) {
				Config::wwwdir = argv[i + 1];
				i++;
				continue;
			}
		}
		if (arg == "-smoke") {
			Config::smoke = true;
			continue;
		}
		{
			std::string msg = "unknown option " + arg;
			print_help(msg);
			return false;
		}
	}
	if (Config::filename == "") {
		print_help("filename is required");
		return false;
	}
	return true;
}


static uint64_t get_ts_group_by_max_buggy(int node, int idx, int count) {
	auto one = ReportManager::getInstance()->pick_one();
	if (one) {
		const auto& range = one->range();
		const auto& line = one->line(node);
		auto total = line.size();
		int i = 0;
		auto pp = line.begin();
		/*
		while (pp != line.end()) {
			std::cerr << "("  << pp->first << "," << pp->second << ") ";
			pp++;
		}
		pp = line.begin();
		std::cerr << "- " << idx << "/" << count << " " << range.left << "," << range.right << std::endl;
		*/
		int64_t val = 0, last_val = 0;
		uint64_t val_ts = 0;
		
		for (; i < count && pp != line.end();) {
			if (pp->first > range.hnext(count, i)) {
				if (i == idx) return val_ts;
				// oss << val * Config::multiplier;
				val = last_val;
				i++;
			}
			else {
				// LOGI << pp->first << "," << pp->second << "\n";
				if (abs(pp->second) > abs(val)) {
					val = pp->second;
					val_ts = pp->first;
				}
				last_val = pp->second;
				pp++;
			}
		}
		return val_ts;
	}
	return 0;
}
static uint64_t get_ts_group_by_max(int node, int idx, int count) {
	auto one = ReportManager::getInstance()->pick_one();
	if (one) {
		const auto& range = one->range();
		const auto& line = one->line(node);
		auto total = line.size();
		auto pp = line.begin();
		bool found = false;
		uint64_t b, e, ts = 0, val = 0;
		if (!range.bucket2(count, idx, b, e)) {
			return 0;
		}
		while (pp != line.end() && pp->first < b) {
			pp++;
		}
		while (pp != line.end() && pp->first < e) {
			if (!found) {
				ts = pp->first;
				val = pp->second;
				found = true;
			}
			else {
				if (pp->second >= val) {
					val = pp->second;
					ts = pp->first;
				}
			}
			pp++;
		}
		if (found) {
			return ts;
		}
		return b;
	}
	return 0;
}
extern "C" void fullscreen_web_view(const char * title);
int main(int argc, char** argv)
{
	/*
	if (FreeConsole()) {
		AllocConsole();
		ShowWindow(GetConsoleWindow(), SW_HIDE);
		freopen("CONOUT$", "w", stdout);
		freopen("CONOUT$", "w", stderr);
	}
	*/
	if (!prepare_config(argc, argv)) {
		return 1;
	}
	std::ifstream infile(Config::filename);
	std::string line;
	int total_lines = 0;
	uint64_t last_ts = 0;
	while (std::getline(infile, line))
	{
		std::istringstream iss(line);
		int pid;
		uint32_t flag;
		uint64_t base, len, bt, ts;

		if (!(iss >> pid >> std::hex >> flag >> base >> len >> bt >> ts)) { // EOF || malformed data
			break; 
		}
		if (!(ts >= last_ts)) {
			break;
		}
		last_ts = ts;
		total_lines++;
		process(pid, flag, base, len, bt, ts);
	}
	infile.close();
	LOGI << "mmtrace.txt consumed:\n";
	LOGI << " " << std::dec << total_lines << " lines processed.\n";
	ReportManager::getInstance()->dump();
	ReportManager::getInstance()->test();
	LOGI << "report is ready at http://127.0.0.1:" << Config::port << "/ui.html \n";
	
	{
		using namespace httplib;
		Server svr;

    if (v){
      for(auto fn: *v){
        fn(svr);
      }
    }
    
		svr.Get("/dump", [](const Request &req, Response &res) {
			res.set_content(dump_headers(req.headers), "text/plain");
		});

		svr.Get(R"(/rect_demo/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto index = atoi(req.matches[1].str().c_str());
			auto total = atoi(req.matches[2].str().c_str());
			auto content1 = R"udsa8j(
{"thread_name":"thread_15200","start_time":3176184875,"max_level":255,"expanded":true,"end_time":3176185514,"data":[[7,"Class7C07<int, int>::MethodD549",3176184875,3176184876,"\\src\\path\\df2f\\8c3d.cpp::641","rgb(74, 228, 35)",false],[9,"Class8FA6<int, int>::Method7FD1",3176185490,3176185491,"\\src\\path\\7fce\\d390.cpp::1545","rgb(24, 161, 235)",false],[8,"ClassE80C<int, int>::MethodC53F",3176185490,3176185491,"\\src\\path\\91b0\\ce63.cpp::4765","rgb(185, 58, 131)",false],[7,"ClassC870<int, int>::MethodEA2A",3176185490,3176185491,"\\src\\path\\7b34\\c48d.cpp::5211","rgb(168, 217, 55)",false],[6,"ClassC41C<int, int>::MethodDAE1",3176185490,3176185491,"\\src\\path\\9282\\cd87.cpp::5808","rgb(218, 122, 201)",false],[8,"ClassC0CC<int, int>::Method9E27",3176185491,3176185492,"\\src\\path\\d335\\a7bb.cpp::5238","rgb(121, 100, 105)",false],[7,"ClassC490<int, int>::MethodA2C8",3176185491,3176185492,"\\src\\path\\7a15\\d75c.cpp::2979","rgb(12, 164, 193)",false],[6,"Class7B0E<int, int>::Method8B42",3176185491,3176185492,"\\src\\path\\9bb5\\b8b0.cpp::1035","rgb(189, 247, 61)",false],[5,"ClassB6BE<int, int>::MethodCE8D",3176185490,3176185492,"\\src\\path\\8470\\cbe1.cpp::1785","rgb(82, 159, 251)",false],[4,"ClassB8A1<int, int>::MethodA2A5",3176185490,3176185494,"\\src\\path\\bd9c\\cd50.cpp::1448","rgb(155, 175, 245)",false],[3,"ClassD15E<int, int>::MethodCE91",3176185490,3176185495,"\\src\\path\\99fc\\b1dd.cpp::2263","rgb(191, 185, 10)",false],[4,"Class8042<int, int>::Method7BC6",3176185495,3176185496,"\\src\\path\\9585\\c08f.cpp::4139","rgb(93, 252, 21)",false],[3,"Class9CF3<int, int>::Method7AB0",3176185495,3176185496,"\\src\\path\\a5f5\\9893.cpp::1376","rgb(237, 133, 186)",false],[2,"ClassE5BB<int, int>::MethodC338",3176185490,3176185499,"\\src\\path\\d170\\9c4d.cpp::4807","rgb(206, 109, 247)",false],[2,"ClassE1BE<int, int>::Method7E9E",3176185499,3176185500,"\\src\\path\\de05\\dfc0.cpp::5920","rgb(192, 152, 100)",false],[6,"ClassB3F3<int, int>::MethodBAAE",3176185500,3176185512,"\\src\\path\\8d68\\ce47.cpp::5282","rgb(26, 149, 153)",false],[5,"ClassE306<int, int>::MethodDCEB",3176185500,3176185512,"\\src\\path\\8609\\96c2.cpp::1137","rgb(86, 188, 21)",false],[4,"Class885B<int, int>::Method89D1",3176185500,3176185512,"\\src\\path\\7778\\9578.cpp::3922","rgb(235, 133, 82)",false],[3,"ClassC00B<int, int>::MethodDD1B",3176185500,3176185512,"\\src\\path\\d111\\77a4.cpp::5016","rgb(82, 110, 112)",false],[2,"Class96CD<int, int>::MethodE2B7",3176185500,3176185512,"\\src\\path\\ad13\\d8c0.cpp::4433","rgb(88, 235, 145)",false],[6,"ClassBDD7<int, int>::MethodE9B9",3176185512,3176185513,"\\src\\path\\da42\\7919.cpp::4955","rgb(33, 185, 2)",false],[5,"ClassDC13<int, int>::Method94CC",3176185512,3176185513,"\\src\\path\\880a\\d912.cpp::1087","rgb(112, 117, 171)",false],[4,"ClassE2AC<int, int>::MethodA111",3176185512,3176185513,"\\src\\path\\811b\\d2e3.cpp::2088","rgb(95, 209, 36)",false],[3,"ClassB033<int, int>::MethodBAEE",3176185512,3176185513,"\\src\\path\\b936\\ca4e.cpp::5341","rgb(152, 122, 60)",false],[2,"ClassBB7F<int, int>::Method98B4",3176185512,3176185513,"\\src\\path\\c69f\\dd9e.cpp::4283","rgb(245, 103, 124)",false],[2,"Class9278<int, int>::Method8987",3176185513,3176185514,"\\src\\path\\9995\\8277.cpp::2778","rgb(153, 206, 115)",false],[1,"Class8CE9<int, int>::MethodB510",3176185479,3176185514,"\\src\\path\\a720\\77b3.cpp::4203","rgb(234, 133, 116)",false],[0,"Class8971<int, int>::MethodD47D",3176184875,3176185514,"\\src\\path\\b58a\\b863.cpp::2490","rgb(108, 167, 89)",false]]}
)udsa8j";
			auto content2 = R"asdada(
{"thread_name":"thread_15200","start_time":3176184875,"max_level":256,"expanded":true,"end_time":3176185514,"data":[[11,"ClassAD3D<int, int>::MethodE789",3176185471,3176185472,"\\src\\path\\85f3\\8603.cpp::1067","rgb(109, 82, 174)",false],[10,"Class7FA9<int, int>::MethodC978",3176185471,3176185472,"\\src\\path\\8aba\\ac88.cpp::447","rgb(179, 81, 3)",false],[9,"ClassDD39<int, int>::MethodC510",3176185471,3176185472,"\\src\\path\\cb63\\c60d.cpp::3050","rgb(181, 146, 92)",false],[8,"Class9E50<int, int>::MethodC475",3176185471,3176185472,"\\src\\path\\7a3c\\d0b6.cpp::1154","rgb(200, 136, 43)",false],[7,"ClassAA2B<int, int>::MethodBAAD",3176185471,3176185472,"\\src\\path\\ae1f\\dbbd.cpp::336","rgb(205, 172, 118)",false],[6,"ClassA61E<int, int>::MethodA584",3176185471,3176185472,"\\src\\path\\b642\\e40d.cpp::3163","rgb(184, 84, 212)",false],[5,"ClassDC13<int, int>::Method94CC",3176185471,3176185472,"\\src\\path\\880a\\d912.cpp::1087","rgb(112, 117, 171)",false],[4,"ClassBB3C<int, int>::MethodBA15",3176185471,3176185472,"\\src\\path\\c14f\\c282.cpp::2227","rgb(52, 236, 229)",false],[3,"ClassC9DA<int, int>::MethodAC2F",3176185471,3176185472,"\\src\\path\\7c2b\\c808.cpp::3835","rgb(165, 229, 163)",false],[2,"ClassE1BE<int, int>::Method7E9E",3176185471,3176185473,"\\src\\path\\de05\\dfc0.cpp::5920","rgb(192, 152, 100)",false],[9,"ClassD19D<int, int>::Method7FAB",3176185473,3176185474,"\\src\\path\\e166\\b656.cpp::5579","rgb(169, 245, 205)",false],[8,"ClassC770<int, int>::MethodB97F",3176185473,3176185475,"\\src\\path\\8213\\76a7.cpp::416","rgb(209, 207, 197)",false],[7,"Class7C07<int, int>::MethodD549",3176185473,3176185478,"\\src\\path\\df2f\\8c3d.cpp::641","rgb(74, 228, 35)",false],[6,"ClassC41C<int, int>::MethodDAE1",3176185473,3176185478,"\\src\\path\\9282\\cd87.cpp::5808","rgb(218, 122, 201)",false],[7,"ClassAE1A<int, int>::Method93D1",3176185478,3176185479,"\\src\\path\\7799\\b636.cpp::2687","rgb(168, 242, 109)",false],[6,"Class897E<int, int>::MethodCAA0",3176185478,3176185479,"\\src\\path\\da2b\\e6aa.cpp::1175","rgb(208, 162, 111)",false],[5,"Class7CC5<int, int>::MethodB00E",3176185473,3176185479,"\\src\\path\\b42f\\b88f.cpp::4352","rgb(5, 236, 88)",false],[4,"Class93DE<int, int>::Method9284",3176185473,3176185479,"\\src\\path\\8f99\\8dc0.cpp::1234","rgb(164, 133, 33)",false],[3,"Class86EF<int, int>::MethodE421",3176185473,3176185479,"\\src\\path\\a5a3\\8ce4.cpp::3386","rgb(0, 238, 61)",false],[2,"Class8F57<int, int>::Method838F",3176185473,3176185479,"\\src\\path\\807f\\7a21.cpp::447","rgb(153, 237, 247)",false],[1,"ClassA440<int, int>::MethodAE4E",3176185471,3176185479,"\\src\\path\\a29d\\e6f3.cpp::3967","rgb(252, 76, 197)",false],[6,"ClassBAB9<int, int>::MethodD835",3176185480,3176185481,"\\src\\path\\8f4f\\9c3e.cpp::4751","rgb(125, 252, 196)",false],[5,"ClassB2DB<int, int>::MethodD410",3176185480,3176185482,"\\src\\path\\9804\\a3b6.cpp::557","rgb(128, 251, 87)",false],[5,"ClassD10F<int, int>::Method82B2",3176185482,3176185483,"\\src\\path\\aa40\\cd7a.cpp::1605","rgb(146, 111, 162)",false],[4,"ClassB8A1<int, int>::MethodA2A5",3176185480,3176185483,"\\src\\path\\bd9c\\cd50.cpp::1448","rgb(155, 175, 245)",false],[3,"ClassC98D<int, int>::MethodAA0B",3176185479,3176185483,"\\src\\path\\da1a\\900a.cpp::3384","rgb(253, 215, 200)",false],[4,"ClassAD05<int, int>::MethodCEF3",3176185483,3176185484,"\\src\\path\\7654\\b466.cpp::1714","rgb(108, 139, 76)",false],[3,"ClassAE9C<int, int>::Method8C76",3176185483,3176185484,"\\src\\path\\e026\\bede.cpp::3838","rgb(173, 165, 153)",false],[8,"ClassA87E<int, int>::MethodDB2F",3176185485,3176185486,"\\src\\path\\bd71\\aa7f.cpp::3198","rgb(155, 126, 242)",false],[7,"Class99BE<int, int>::Method96A7",3176185485,3176185486,"\\src\\path\\d632\\c061.cpp::3324","rgb(228, 172, 111)",false],[6,"Class7EEE<int, int>::MethodC24B",3176185485,3176185486,"\\src\\path\\7853\\b7ca.cpp::353","rgb(159, 94, 216)",false],[5,"Class8A0D<int, int>::MethodE7FE",3176185485,3176185487,"\\src\\path\\e8e6\\b204.cpp::1234","rgb(236, 147, 36)",false],[6,"Class8A15<int, int>::Method87B9",3176185487,3176185488,"\\src\\path\\879d\\8bf5.cpp::1586","rgb(63, 202, 124)",false],[5,"ClassD10F<int, int>::Method82B2",3176185487,3176185488,"\\src\\path\\aa40\\cd7a.cpp::1605","rgb(146, 111, 162)",false],[7,"ClassAE1A<int, int>::Method93D1",3176185488,3176185490,"\\src\\path\\7799\\b636.cpp::2687","rgb(168, 242, 109)",false],[6,"ClassAE0E<int, int>::MethodB529",3176185488,3176185490,"\\src\\path\\db34\\db41.cpp::5987","rgb(138, 162, 205)",false],[5,"Class7CC5<int, int>::MethodB00E",3176185488,3176185490,"\\src\\path\\b42f\\b88f.cpp::4352","rgb(5, 236, 88)",false],[4,"ClassD051<int, int>::Method9975",3176185485,3176185490,"\\src\\path\\d595\\ded0.cpp::5262","rgb(106, 76, 240)",false],[3,"ClassAE9C<int, int>::Method8C76",3176185485,3176185490,"\\src\\path\\e026\\bede.cpp::3838","rgb(173, 165, 153)",false],[2,"Class96CD<int, int>::MethodE2B7",3176185479,3176185490,"\\src\\path\\ad13\\d8c0.cpp::4433","rgb(88, 235, 145)",false],[9,"Class8FA6<int, int>::Method7FD1",3176185490,3176185491,"\\src\\path\\7fce\\d390.cpp::1545","rgb(24, 161, 235)",false],[8,"ClassE80C<int, int>::MethodC53F",3176185490,3176185491,"\\src\\path\\91b0\\ce63.cpp::4765","rgb(185, 58, 131)",false],[7,"ClassC870<int, int>::MethodEA2A",3176185490,3176185491,"\\src\\path\\7b34\\c48d.cpp::5211","rgb(168, 217, 55)",false],[6,"ClassC41C<int, int>::MethodDAE1",3176185490,3176185491,"\\src\\path\\9282\\cd87.cpp::5808","rgb(218, 122, 201)",false],[8,"ClassC0CC<int, int>::Method9E27",3176185491,3176185492,"\\src\\path\\d335\\a7bb.cpp::5238","rgb(121, 100, 105)",false],[7,"ClassC490<int, int>::MethodA2C8",3176185491,3176185492,"\\src\\path\\7a15\\d75c.cpp::2979","rgb(12, 164, 193)",false],[6,"Class7B0E<int, int>::Method8B42",3176185491,3176185492,"\\src\\path\\9bb5\\b8b0.cpp::1035","rgb(189, 247, 61)",false],[5,"ClassB6BE<int, int>::MethodCE8D",3176185490,3176185492,"\\src\\path\\8470\\cbe1.cpp::1785","rgb(82, 159, 251)",false],[4,"ClassB8A1<int, int>::MethodA2A5",3176185490,3176185494,"\\src\\path\\bd9c\\cd50.cpp::1448","rgb(155, 175, 245)",false],[3,"ClassD15E<int, int>::MethodCE91",3176185490,3176185495,"\\src\\path\\99fc\\b1dd.cpp::2263","rgb(191, 185, 10)",false],[4,"Class8042<int, int>::Method7BC6",3176185495,3176185496,"\\src\\path\\9585\\c08f.cpp::4139","rgb(93, 252, 21)",false],[3,"Class9CF3<int, int>::Method7AB0",3176185495,3176185496,"\\src\\path\\a5f5\\9893.cpp::1376","rgb(237, 133, 186)",false],[2,"ClassE5BB<int, int>::MethodC338",3176185490,3176185499,"\\src\\path\\d170\\9c4d.cpp::4807","rgb(206, 109, 247)",false],[2,"ClassE1BE<int, int>::Method7E9E",3176185499,3176185500,"\\src\\path\\de05\\dfc0.cpp::5920","rgb(192, 152, 100)",false],[6,"ClassB3F3<int, int>::MethodBAAE",3176185500,3176185512,"\\src\\path\\8d68\\ce47.cpp::5282","rgb(26, 149, 153)",false],[5,"ClassE306<int, int>::MethodDCEB",3176185500,3176185512,"\\src\\path\\8609\\96c2.cpp::1137","rgb(86, 188, 21)",false],[4,"Class885B<int, int>::Method89D1",3176185500,3176185512,"\\src\\path\\7778\\9578.cpp::3922","rgb(235, 133, 82)",false],[3,"ClassC00B<int, int>::MethodDD1B",3176185500,3176185512,"\\src\\path\\d111\\77a4.cpp::5016","rgb(82, 110, 112)",false],[2,"Class96CD<int, int>::MethodE2B7",3176185500,3176185512,"\\src\\path\\ad13\\d8c0.cpp::4433","rgb(88, 235, 145)",false],[6,"ClassBDD7<int, int>::MethodE9B9",3176185512,3176185513,"\\src\\path\\da42\\7919.cpp::4955","rgb(33, 185, 2)",false],[5,"ClassDC13<int, int>::Method94CC",3176185512,3176185513,"\\src\\path\\880a\\d912.cpp::1087","rgb(112, 117, 171)",false],[4,"ClassE2AC<int, int>::MethodA111",3176185512,3176185513,"\\src\\path\\811b\\d2e3.cpp::2088","rgb(95, 209, 36)",false],[3,"ClassB033<int, int>::MethodBAEE",3176185512,3176185513,"\\src\\path\\b936\\ca4e.cpp::5341","rgb(152, 122, 60)",false],[2,"ClassBB7F<int, int>::Method98B4",3176185512,3176185513,"\\src\\path\\c69f\\dd9e.cpp::4283","rgb(245, 103, 124)",false],[2,"Class9278<int, int>::Method8987",3176185513,3176185514,"\\src\\path\\9995\\8277.cpp::2778","rgb(153, 206, 115)",false],[1,"Class8CE9<int, int>::MethodB510",3176185479,3176185514,"\\src\\path\\a720\\77b3.cpp::4203","rgb(234, 133, 116)",false],[0,"Class8971<int, int>::MethodD47D",3176184875,3176185514,"\\src\\path\\b58a\\b863.cpp::2490","rgb(108, 167, 89)",false]]}
)asdada";
			res.set_header("Access-Control-Allow-Origin", "*");
			if (index % 2) {
				res.set_content(content1, "application/json");
			}
			else {
				res.set_content(content2, "application/json");
			}
		});

		svr.Get(R"(/rect/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto index = atoi(req.matches[1].str().c_str());
			auto total = atoi(req.matches[2].str().c_str());
			auto one = ReportManager::getInstance()->pick_one();
			if (total < 1) total = 1;
			if (index > total) index = total;
			if (one) {
				std::ostringstream oss;
				const auto& range = one->range();
				const auto& line = one->line(0);

				uint64_t ts = (range.right - range.left) * index / total + range.left;
				// R"-=-=-=-()-=-=-=-"
				oss << R"-=-=-=-(
{
	"thread_name":"thread_15200",
	"start_time":0,
	"max_level":255,
	"expanded":true,
)-=-=-=-";
				oss << "\"end_time\":" << range.top - range.bottom
					<< ",\"data\":[";
				int i = 0;
				for (const auto& rect : one->rect(ts)) {
					if (rect.right - rect.left > Config::threshold) {
						if (i) oss << ",\n";
						oss << "[" << rect.layer << ",\""
							<< one->bt(i) << "\"," // Todo: escape
							<< rect.left << ","
							<< rect.right << ","
							<< i << "]";
					}
					i++;
				}
				oss << "]}";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
				return;
			}
			res.set_content("Oops~", "text/plain");

		});
		svr.Get(R"(/rect2/(\d+)/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			// 保证 node 节点上的大小跟 line graph 的数值相等
			auto node = atoi(req.matches[1].str().c_str());
			auto index = atoi(req.matches[2].str().c_str());
			auto total = atoi(req.matches[3].str().c_str());
			auto one = ReportManager::getInstance()->pick_one();
			if (total < 3) total = 3;
			if (index >= total) index = total - 1;
			if (one) {
				std::ostringstream oss;
				const auto& range = one->range();
				const auto& line = one->line(0);
				uint64_t ts = get_ts_group_by_max(node, index, total);

				// uint64_t ts = (range.right - range.left) * index / total + range.left;
				// R"-=-=-=-()-=-=-=-"
				oss << R"-=-=-=-(
{
	"thread_name":"thread_15200",
	"start_time":0,
	"max_level":255,
	"expanded":true,
)-=-=-=-";
				oss << "\"end_time\":" << range.top - range.bottom
					<< ",\"data\":[";
				int i = 0;
				for (const auto& rect : one->rect(ts)) {
					if (rect.right - rect.left > Config::threshold) {
						if (i) oss << ",\n";
						oss << "[" << rect.layer << ",\""
							<< one->bt(i) << "\"," // Todo: escape
							<< rect.left << ","
							<< rect.right << ","
							<< i << "]";
					}
					i++;
				}
				oss << "]}";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
				return;
			}
			res.set_content("Oops~", "text/plain");

		});

		svr.Get(R"(/timestamp/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto index = atoi(req.matches[1].str().c_str());
			auto total = atoi(req.matches[2].str().c_str());
			if (total < 1) total = 1;
			if (index > total) index = total;
			auto one = ReportManager::getInstance()->pick_one();
			if (one) {
				std::ostringstream oss;
				const auto& range = one->range();
				uint64_t ts = (range.right - range.left) * index / total + range.left;
				oss << ts;
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
				return;
			}
			res.set_content("Oops~", "text/plain");
		});
		svr.Get(R"(/delta/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto node = atoi(req.matches[1].str().c_str());
			auto count = atoi(req.matches[2].str().c_str());
			auto one = ReportManager::getInstance()->pick_one();
			if (count <= 3) count = 3;
			auto sample_count = count + 1;

			if (one) {
				std::ostringstream oss;
				oss << "[";
				const auto& range = one->range();
				const auto& line = one->line(node);
				auto total = line.size();
				int i = 0;
				auto pp = line.begin();
				int64_t val = 0, last_val = 0, candidate = 0;
				LOGI << "range:" << range.left << "," << range.right
					<< "; line.size: " << line.size()
					<< "\n";
				for (; i < sample_count && pp != line.end();) {
					if (pp->first > range.hnext(sample_count, i)) {
						// outside the bucket, update idx
						if (i > 0) { // skip first one
							oss << (val - last_val) * Config::multiplier;
							if (i != sample_count - 1) {
								oss << ",";
							}
						}
						last_val = val;
						i++;
					}
					else {
						// in bucket, update value
						// LOGI << pp->first << "," << pp->second << "\n";
						val = pp->second; // rightmost
						pp++; // next sample
					}
				}
				while (i < sample_count) {
					if (i > 0) { // skip first one
						oss << 0;
						if (i != sample_count - 1) {
							oss << ",";
						}
					}
					i++;
				}
				oss << "]";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
				return;
			}
			res.set_content("Oops~", "text/plain");
		});
		svr.Get(R"(/line/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto node = atoi(req.matches[1].str().c_str());
			auto count = atoi(req.matches[2].str().c_str());
			auto one = ReportManager::getInstance()->pick_one();
			if (count <= 3) count = 3; 
			
			if (one) {
				std::ostringstream oss;
				oss << "[";
				const auto& range = one->range();
				const auto& line = one->line(node);
				auto total = line.size();
				int i = 0;
				auto pp = line.begin();
				int64_t val = 0, last_val = 0;
				LOGI << "range:" << range.left << "," << range.right 
					<< "; line.size: " << line.size()
					<< "\n";
				for (; i < count && pp != line.end();) {
					if (pp->first > range.hnext(count, i)) {
						oss << val * Config::multiplier;
						if (i != count - 1) {
							oss << ",";
						}
						val = last_val;
						i++;
					}
					else {
						// LOGI << pp->first << "," << pp->second << "\n";
						if (abs(pp->second) > abs(val)) {
							val = pp->second;
						}
						last_val = pp->second;
						pp++;
					}
				}
				while (i < count) {
					oss << last_val * Config::multiplier;
					if (i != count - 1) {
						oss << ",";
					}
					i++;
				}
				oss << "]";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
				return;
			}
			res.set_content("Oops~", "text/plain");
		});
		svr.Get(R"(/marks/(\d+))", [&](const Request& req, Response& res) {
			auto count = atoi(req.matches[1].str().c_str());
			if (count < 3) count = 3;
			auto one = ReportManager::getInstance()->pick_one();
			if (one) {
				auto range = one->range();
				std::ostringstream oss;
				int last_idx = -1;
				int i = 0;
				oss << "[";
				for (auto &e : one->events()) {
					int idx = range.bucket(e.first, count);
					if (idx != -1 && idx > last_idx) {
						last_idx = idx;
						if (i ++ > 0) {
							oss << ",";
						}
						oss << idx;
					}
				}
				oss << "]";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
			}
		});
		svr.Get(R"(/label/(\d+)/(\d+)/(\d+))", [&](const Request& req, Response& res) {
			auto index1 = atoi(req.matches[1].str().c_str());
			auto index2 = atoi(req.matches[2].str().c_str());
			auto total = atoi(req.matches[3].str().c_str());
			auto one = ReportManager::getInstance()->pick_one();
			if (total < 1) total = 1;
			if (index1 > total) index1 = total;
			if (index2 > total) index2 = total;
			if (index1 > index2) std::swap(index1, index2);
			if (one) {
				auto range = one->range();
				std::ostringstream oss;
				int i = 0;
				oss << "[";
				for (auto &e : one->events()) {
					int idx = range.bucket(e.first, total);
					if (idx != -1 && idx >= index1 && idx <= index2) {
						if (i++ > 0) {
							oss << ",";
						}
						oss << "\"" << e.second << "\"";
					}
				}
				oss << "]";
				res.set_header("Access-Control-Allow-Origin", "*");
				res.set_content(oss.str(), "application/json");
			}
		});
		// fullscreen_web_view("hello");
		svr.set_mount_point("/", Config::wwwdir.c_str());
		svr.listen(Config::host.c_str(), Config::port);
	}
	return 0;
}

