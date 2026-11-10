
"use strict";

// Assignment 11 - Dynamic BSIT Course Advisor

let courses = [];
const completedCourses = new Set();
const plannedCourses = new Set();

const checklist = document.getElementById("course-checklist");
const availableContainer = document.getElementById("available-courses");
const lockedContainer = document.getElementById("locked-courses");
const plannedContainer = document.getElementById("planned-courses");
const semesterPlan = document.getElementById("semester-plan");
const emptyPlanMessage = document.getElementById("empty-plan-message");
const resetButton = document.getElementById("reset-button");

// Load the external JSON database
async function loadCourses() {
    try {
        const response = await fetch("data/courses.json");

        if (!response.ok) {
            throw new Error("Could not load the course database.");
        }

        const data = await response.json();

        if (!Array.isArray(data.courses)) {
            throw new Error("Invalid course database format.");
        }

        courses = data.courses;

        renderAdvisor();
    } catch (error) {
        console.error(error);

        checklist.textContent =
            "Unable to load courses. Run the project through a local web server.";

        availableContainer.textContent = "Course data unavailable.";
        lockedContainer.textContent = "Course data unavailable.";
    }
}

// Look up a course by its ID
function getCourse(id) {
    return courses.find(course => course.id === id);
}

// Recursively evaluate AND and OR prerequisites
function meetsPrerequisites(requirement) {
    if (!requirement) {
        return true;
    }

    if (typeof requirement === "string") {
        return completedCourses.has(requirement);
    }

    if (Array.isArray(requirement)) {
        return requirement.every(meetsPrerequisites);
    }

    if (requirement.allOf) {
        return requirement.allOf.every(meetsPrerequisites);
    }

    if (requirement.anyOf) {
        return requirement.anyOf.some(meetsPrerequisites);
    }

    return false;
}

// Identify mutually exclusive course alternatives
function getConflictingCourse(course) {
    if (!course.exclusiveGroup) {
        return null;
    }

    return courses.find(other =>
        other.id !== course.id &&
        other.exclusiveGroup === course.exclusiveGroup &&
        (
            completedCourses.has(other.id) ||
            plannedCourses.has(other.id)
        )
    ) || null;
}

// Determine if a course can currently be selected
function isEligible(course) {
    return (
        !completedCourses.has(course.id) &&
        !getConflictingCourse(course) &&
        meetsPrerequisites(course.prerequisites)
    );
}

// Convert prerequisite data into readable text
function describePrerequisites(requirement) {
    if (!requirement) {
        return "No prerequisites in this demonstration.";
    }

    if (typeof requirement === "string") {
        return requirement;
    }

    if (Array.isArray(requirement)) {
        return requirement.map(describePrerequisites).join(" AND ");
    }

    if (requirement.allOf) {
        return requirement.allOf
            .map(item => {
                const text = describePrerequisites(item);
                return typeof item === "object"
                    ? "(" + text + ")"
                    : text;
            })
            .join(" AND ");
    }

    if (requirement.anyOf) {
        return requirement.anyOf
            .map(describePrerequisites)
            .join(" OR ");
    }

    return "See academic advisor.";
}

// Create a reusable paragraph
function createParagraph(className, text) {
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = text;
    return paragraph;
}

// Dynamically create completed-course checkboxes
function renderChecklist() {
    checklist.replaceChildren();

    courses.forEach(course => {
        const item = document.createElement("div");
        item.className = "checklist-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "completed-" + course.id;
        checkbox.checked = completedCourses.has(course.id);

        const conflict = getConflictingCourse(course);

        if (conflict && !checkbox.checked) {
            checkbox.disabled = true;
            item.classList.add("disabled-choice");
        }

        if (checkbox.checked) {
            item.classList.add("completed");
        }

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;

        const code = document.createElement("strong");
        code.textContent = course.id;

        label.appendChild(code);
        label.appendChild(
            document.createTextNode(
                course.name + " (" + course.credits + " credits)"
            )
        );

        if (conflict && !checkbox.checked) {
            label.appendChild(
                createParagraph(
                    "course-meta",
                    "Alternative selected: " + conflict.id
                )
            );
        }

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                completedCourses.add(course.id);
                plannedCourses.delete(course.id);
            } else {
                completedCourses.delete(course.id);
            }

            reconcilePlan();
            renderAdvisor();
        });

        item.append(checkbox, label);
        checklist.appendChild(item);
    });
}

// Dynamically create course cards
function createCourseCard(course, available) {
    const card = document.createElement("article");

    card.className = "course-card " +
        (available ? "available" : "locked");

    const code = document.createElement("span");
    code.className = "course-code";
    code.textContent = course.id;

    const title = document.createElement("h3");
    title.textContent = course.name;

    const metadata = createParagraph(
        "course-meta",
        course.category + " | " + course.credits + " credits"
    );

    const status = document.createElement("span");
    status.className = "course-status " +
        (available ? "status-available" : "status-locked");

    status.textContent = available ? "Eligible" : "Not Available";

    const prerequisiteInfo = createParagraph(
        "prerequisite-info",
        "Prerequisites: " +
        describePrerequisites(course.prerequisites)
    );

    const note = document.createElement("div");
    note.className = "course-note";

    const noteHeading = document.createElement("strong");
    noteHeading.textContent = "Advising Note";

    const noteText = document.createElement("p");
    noteText.textContent = course.note || "No additional notes.";

    note.append(noteHeading, noteText);

    card.append(
        code,
        title,
        metadata,
        status,
        prerequisiteInfo,
        note
    );

    if (available) {
        if (plannedCourses.has(course.id)) {
            const plannedStatus = createParagraph(
                "course-status status-planned",
                "Added to Semester Plan"
            );

            card.appendChild(plannedStatus);
        } else {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Add to Plan";

            button.addEventListener("click", () => {
                addToPlan(course.id);
            });

            card.appendChild(button);

            // HTML5 drag-and-drop
            card.draggable = true;

            card.addEventListener("dragstart", event => {
                event.dataTransfer.setData("text/plain", course.id);
                event.dataTransfer.effectAllowed = "copy";
            });
        }
    } else {
        const conflict = getConflictingCourse(course);

        const explanation = conflict
            ? "Unavailable because " + conflict.id +
              " is already completed or planned."
            : "Complete the listed prerequisites to unlock this course.";

        card.appendChild(
            createParagraph("course-meta", explanation)
        );
    }

    return card;
}

// Display eligible and locked courses
function renderCourseCards() {
    availableContainer.replaceChildren();
    lockedContainer.replaceChildren();

    let availableCount = 0;
    let lockedCount = 0;

    courses.forEach(course => {
        if (completedCourses.has(course.id)) {
            return;
        }

        if (isEligible(course)) {
            availableContainer.appendChild(
                createCourseCard(course, true)
            );
            availableCount++;
        } else {
            lockedContainer.appendChild(
                createCourseCard(course, false)
            );
            lockedCount++;
        }
    });

    if (availableCount === 0) {
        availableContainer.appendChild(
            createParagraph(
                "empty-message",
                "No additional eligible courses are available."
            )
        );
    }

    if (lockedCount === 0) {
        lockedContainer.appendChild(
            createParagraph(
                "empty-message",
                "There are no locked courses."
            )
        );
    }

    document.getElementById("available-count").textContent =
        availableCount;
}

// Add a course to the semester plan
function addToPlan(courseId) {
    const course = getCourse(courseId);

    if (
        !course ||
        !isEligible(course) ||
        plannedCourses.has(courseId)
    ) {
        return;
    }

    plannedCourses.add(courseId);

    renderAdvisor();
}

// Remove a course from the semester plan
function removeFromPlan(courseId) {
    plannedCourses.delete(courseId);
    reconcilePlan();
    renderAdvisor();
}

// Remove planned courses that are no longer eligible
function reconcilePlan() {
    let changed;

    do {
        changed = false;

        for (const id of Array.from(plannedCourses)) {
            const course = getCourse(id);

            if (!course || !isEligible(course)) {
                plannedCourses.delete(id);
                changed = true;
            }
        }
    } while (changed);
}

// Dynamically create semester plan cards
function renderSemesterPlan() {
    plannedContainer.replaceChildren();

    let totalCredits = 0;

    plannedCourses.forEach(courseId => {
        const course = getCourse(courseId);

        if (!course) {
            return;
        }

        totalCredits += course.credits;

        const card = document.createElement("article");
        card.className = "planned-card";

        const heading = document.createElement("h3");
        heading.textContent = course.id + " - " + course.name;

        const credits = createParagraph(
            "course-meta",
            course.credits + " credits"
        );

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Remove from Plan";

        button.addEventListener("click", () => {
            removeFromPlan(course.id);
        });

        card.append(heading, credits, button);
        plannedContainer.appendChild(card);
    });

    emptyPlanMessage.hidden = plannedCourses.size > 0;

    document.getElementById("planned-count").textContent =
        plannedCourses.size;

    document.getElementById("planned-credits").textContent =
        totalCredits;

    document.getElementById("credit-total").textContent =
        totalCredits;
}

// Update the entire advisor
function renderAdvisor() {
    renderChecklist();
    renderCourseCards();
    renderSemesterPlan();

    document.getElementById("completed-count").textContent =
        completedCourses.size;
}

// Allow drag-and-drop into the semester planner
semesterPlan.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    semesterPlan.classList.add("drag-over");
});

semesterPlan.addEventListener("dragleave", event => {
    if (!semesterPlan.contains(event.relatedTarget)) {
        semesterPlan.classList.remove("drag-over");
    }
});

semesterPlan.addEventListener("drop", event => {
    event.preventDefault();
    semesterPlan.classList.remove("drag-over");

    const courseId = event.dataTransfer.getData("text/plain");
    addToPlan(courseId);
});

// Reset the advisor
resetButton.addEventListener("click", () => {
    const confirmed = confirm(
        "Clear all completed courses and your semester plan?"
    );

    if (!confirmed) {
        return;
    }

    completedCourses.clear();
    plannedCourses.clear();

    renderAdvisor();
});

// Start the application
loadCourses();
