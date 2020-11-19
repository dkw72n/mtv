.PHONY: all gen clean

all:  mtv

gen: 
	rm gen/* -f
	python3 scripts/gen_cpp.py ui/ui.html /ui.html --output gen/ui.html.cpp
	python3 scripts/gen_cpp.py ui/css/bootstrap.min.css /css/bootstrap.min.css --output gen/css_bootstrap.min.css.cpp
	python3 scripts/gen_cpp.py ui/css/ui.css /css/ui.css --output gen/css_ui.css.cpp
	python3 scripts/gen_cpp.py ui/tpt/d3-timeline-chart.css /tpt/d3-timeline-chart.css --output gen/tpt_d3-timeline-chart.css.cpp
	python3 scripts/gen_cpp.py ui/tpt/d3-time-flame-graph.css /tpt/d3-time-flame-graph.css --output gen/tpt_d3-time-flame-graph.css.cpp
	python3 scripts/gen_cpp.py ui/tpt/d3.v5.min.js /tpt/d3.v5.min.js --output gen/tpt_d3.v5.min.js.cpp
	python3 scripts/gen_cpp.py ui/tpt/d3-linechart.js /tpt/d3-linechart.js --output gen/tpt_d3-linechart.js.cpp
	python3 scripts/gen_cpp.py ui/tpt/d3-time-flame-graph.js /tpt/d3-time-flame-graph.js --output gen/tpt_d3-time-flame-graph.js.cpp
	python3 scripts/gen_cpp.py ui/dist/bundle.js /dist/bundle.js --output gen/dist_bundle.js.cpp

clean:
	rm mtv -f
	rm gen/* -f

mtv: mtv.cpp gen httplib.h
	g++ -o mtv -std=c++17  -O3 gen/*.cpp mtv.cpp -pthread -lstdc++fs