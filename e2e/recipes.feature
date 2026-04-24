Feature: Recipes
  Users can browse, search, and view recipes.

  Scenario: View the recipes list
    Given I am signed in
    When I navigate to "/recipes"
    Then I should see the page title "Recipes"
    And I should see at least 1 recipe card

  Scenario: Search for a recipe
    Given I am signed in
    And I navigate to "/recipes"
    When I type "chicken" into the search box
    Then every visible recipe card should contain "chicken"

  Scenario: View recipe detail
    Given I am signed in
    And I navigate to "/recipes"
    When I click the first recipe card
    Then I should see the recipe title
    And I should see a "Shared base" section or a version section
