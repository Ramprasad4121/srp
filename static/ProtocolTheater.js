/**
 * ProtocolTheater.js
 * Handles D3.js animated visualizations for SRP.
 */

class ProtocolTheater {
    constructor(containerId) {
        this.container = d3.select(`#${containerId}`);
        this.width = this.container.node().getBoundingClientRect().width;
        this.height = this.container.node().getBoundingClientRect().height;
        this.svg = this.container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`);
            
        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2));
            
        this.nodes = [];
        this.links = [];
    }

    renderSystemMap(data) {
        this.svg.selectAll("*").remove();
        this.nodes = data.nodes;
        this.links = data.links;

        const link = this.svg.append("g")
            .selectAll("line")
            .data(this.links)
            .join("line")
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5);

        const node = this.svg.append("g")
            .selectAll("g")
            .data(this.nodes)
            .join("g")
            .call(this.drag(this.simulation));

        node.append("rect")
            .attr("width", 120)
            .attr("height", 40)
            .attr("x", -60)
            .attr("y", -20)
            .attr("fill", "#0f0f0f")
            .attr("stroke", "#00ff88")
            .attr("stroke-width", 1);

        node.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("fill", "#e0e0e0")
            .attr("font-family", "JetBrains Mono")
            .attr("font-size", "10px")
            .text(d => d.name);

        this.simulation.nodes(this.nodes).on("tick", () => {
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        this.simulation.force("link").links(this.links);
    }

    animateValueFlow(flow) {
        const source = this.nodes.find(n => n.id === flow.from);
        const target = this.nodes.find(n => n.id === flow.to);
        
        if (!source || !target) return;

        const token = this.svg.append("circle")
            .attr("r", 5)
            .attr("fill", "#00ff88")
            .attr("cx", source.x)
            .attr("cy", source.y);

        token.transition()
            .duration(2000)
            .attr("cx", target.x)
            .attr("cy", target.y)
            .remove();
            
        this.svg.append("text")
            .attr("x", (source.x + target.x) / 2)
            .attr("y", (source.y + target.y) / 2 - 10)
            .attr("text-anchor", "middle")
            .attr("fill", "#ffaa00")
            .attr("font-size", "8px")
            .text(flow.asset)
            .transition()
            .duration(2000)
            .style("opacity", 0)
            .remove();
    }

    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
