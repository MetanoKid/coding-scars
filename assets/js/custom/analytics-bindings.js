$(document).ready(function() {
	let elementClassToEvent = {
		".series-post-entry-link": "Series entry",
		".previous-post-top":      "Previous post top",
		".next-post-top":          "Next post top",
		".previous-post":          "Previous post bottom",
		".next-post":              "Next post bottom",
		".related-post":           "Related post",
	};

	for(elementClass in elementClassToEvent) {
		$(elementClass).on("click", (event) => {
			ga("send", "event", "Link", elementClassToEvent[elementClass], $(this).attr("href"));
		});
	}
});