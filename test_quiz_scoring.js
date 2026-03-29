/**
 * Test du nouveau système de scoring des quiz
 */

// Simulation d'une soumission Tally avec les bonnes réponses
const correctSubmission = {
    quizId: "2EBGVb", // STEP01_quiz
    courseId: "pw05-2",
    classId: "step01-valeurs-wge",
    answers: [
        {
            key: "question_abc123",
            label: "Quelles sont les 3 valeurs fondamentales de WGE ?",
            value: "Excellence, Confiance, Engagement"
        },
        {
            key: "question_def456", 
            label: "Qui présente les valeurs de WGE dans la vidéo ?",
            value: "Julien CORNILLON"
        }
    ]
};

// Simulation d'une soumission avec des réponses incorrectes
const incorrectSubmission = {
    quizId: "2EBGVb",
    courseId: "pw05-2", 
    classId: "step01-valeurs-wge",
    answers: [
        {
            key: "question_abc123",
            label: "Quelles sont les 3 valeurs fondamentales de WGE ?",
            value: "Innovation, Qualité, Service" // INCORRECT
        },
        {
            key: "question_def456",
            label: "Qui présente les valeurs de WGE dans la vidéo ?",
            value: "Mai KUROKAWA" // INCORRECT
        }
    ]
};

async function testQuizScoring() {
    const API_BASE = "https://lms-api.matthieu-marielouise.workers.dev";
    
    
    // Test avec bonnes réponses
    
    try {
        const response = await fetch(`${API_BASE}/api/quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // Token de test
            },
            body: JSON.stringify(correctSubmission)
        });
        
        const result = await response.json();
        
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
    
    // Test avec mauvaises réponses
    
    try {
        const response = await fetch(`${API_BASE}/api/quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify(incorrectSubmission)
        });
        
        const result = await response.json();
        
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
}

// Exécuter le test
testQuizScoring();
