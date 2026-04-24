Feature: Dietary Profiles
  Users can create, edit, and delete dietary profiles.

  Scenario: Create a new profile
    Given I am signed in
    And I navigate to "/profiles"
    When I click the "New profile" button
    And I fill in "name" with "Maria"
    And I fill in "restrictions" with "vegetarian, no dairy"
    And I fill in "allergies" with "peanuts"
    And I click the "Save" button
    Then I should see a profile card for "Maria"
    And the profile card should show "vegetarian" and "no dairy"

  Scenario: Edit an existing profile
    Given I am signed in
    And a profile "Gian" exists
    And I navigate to "/profiles"
    When I click the edit button for "Gian"
    And I fill in "restrictions" with "no soy, no dairy"
    And I click the "Save" button
    Then the profile card for "Gian" should show "no soy" and "no dairy"

  Scenario: Delete a profile
    Given I am signed in
    And a profile "ToDelete" exists
    And I navigate to "/profiles"
    When I click the delete button for "ToDelete"
    Then I should not see a profile card for "ToDelete"
