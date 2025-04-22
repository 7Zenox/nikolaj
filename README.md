# *nikolaj*

A repository for a Statistical Machine Learning Hackathon conducted at Bennett University during 12-13 November, 2022. Created by Team number 22 as part of the hackathon itself, by members Vasu Jain, Manya Sharma, and Anand Chauhan. The entire project was developed during the hackathon, over the course of 18 hours.

![Demonstration of the police patrol plotting application in action.](assets/nikolaj.gif)

## `IDEA`

The central idea of the project is to attempt to create a useful police patrol plotter using crime data. Of course, the availablility of crime data with location co-ordination proved to be the most limiting factor in the entire project, and we could only find 4 such datasets that were completely usable.

As user input, our program requires the following:

- the city that the plot is for
- the number of precincts
- average number of officers per precinct (NOT IMPLEMENTED YET)
- the timeframe of the shift

Most of this is handled with a friendly user interface. The main hurdle to cross now is the fact that the program is quite slow. Which, could be expected considering the amount of data that needs to be processed every time a new request is received, still needs optimization wherever possible nonetheless. And the fact that we need to find a proof of concept to actually chart the routes themselves that can be implemented. Some example screenshots are attached.

## Algorithm Updates

To address performance bottlenecks in silhouette‐score computation and keep the UI responsive, we’ve introduced the following enhancements:

1. **Approximate Silhouette (O(n·k) time)**  
   - Instead of the full O(n²) pairwise approach, each point’s silhouette **aᵢ** is computed as its distance to its **own centroid**, and **bᵢ** as its distance to the **nearest other centroid**.  
   - This reduces the workload from quadratic in the number of points (n) to linear in n times the number of clusters (k).

2. **Web Worker for Asynchronous Computation**  
   - All silhouette calculations now run in a dedicated **Web Worker** (via a Blob URL), completely off the main thread.  
   - The map and clustering traces render instantly, while the worker computes the score in the background.

3. **Immediate Map Rendering + Spinner Badge**  
   - We call `Plotly.newPlot(...)` as soon as the iframe loads, so the cluster map and secondary boundaries appear without delay.  
   - A lightweight loading badge (spinner + “Computing score…”) is overlaid in the top‑left corner until the worker returns the final score.

4. **Seamless UI Update**  
   - Once the worker posts the computed silhouette value, the spinner badge text is replaced with **“Silhouette Score: X.XX”**, and the worker is terminated.

These changes preserve interactivity, cut down “loading” perception to zero, and still deliver a meaningful cluster‐quality metric within milliseconds—even for thousands of data points.